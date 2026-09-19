import { isIP } from 'node:net';
import compress from '@fastify/compress';
import multipart from '@fastify/multipart';
import { ValidationPipe } from '@nestjs/common';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import type { FastifyRequest, FastifyServerOptions } from 'fastify';
import { EnvelopeInterceptor } from './common/envelope.interceptor';
import { ProblemDetailsFilter } from './common/problem-details.filter';

// Max upload size 25 MB (spec 11); env override exists so tests can exercise
// the 413 path with small payloads.
const DEFAULT_MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

// Shared between main.ts and e2e tests so both run the exact same pipeline.
export async function configureApp(app: NestFastifyApplication): Promise<void> {
  // The admin UI is a separate origin; auth uses bearer tokens, not cookies.
  // Every authenticated call carries an Authorization header, which makes it a
  // non-simple request: without maxAge the browser preflights each one, so an
  // admin screen that issues ten requests pays twenty round trips to another
  // host in production. A day is the ceiling Chromium honours.
  app.enableCors({
    origin: process.env.WEB_ORIGIN ?? 'http://localhost:3000',
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    maxAge: 86400,
  });
  // Nothing compressed responses before this: a delivery page went out at
  // 13.6 kB where 3.6 kB would do (73% smaller), and the site stylesheet at
  // 1.1 kB where 336 B would do. The 1 KB threshold matters in both
  // directions: gzipping a 43-byte envelope makes it larger, so small
  // responses are left alone.
  //
  // Awaited, unlike multipart below. Compression works by adding an onSend
  // hook, and on a cold boot the fire-and-forget form loses the race with
  // Nest's route registration: the hook never joins the handler chain and
  // every response ships uncompressed. Verified as a controlled pair against
  // a cold-booted server. A watch reload happens to load plugins early enough
  // to hide it, which is exactly what makes the bug easy to miss.
  await app.register(compress, { threshold: 1024, encodings: ['br', 'gzip', 'deflate'] });
  // Fastify queues the plugin and loads it on ready(), so no await is needed.
  void app.register(multipart, {
    limits: { fileSize: Number(process.env.MEDIA_MAX_UPLOAD_BYTES ?? DEFAULT_MAX_UPLOAD_BYTES) },
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new ProblemDetailsFilter());
  app.useGlobalInterceptors(new EnvelopeInterceptor());
  app.enableShutdownHooks();
}

// Named ranges proxy-addr understands, accepted next to literal addresses and
// CIDR ranges.
const TRUST_PROXY_PRESETS = ['loopback', 'linklocal', 'uniquelocal'];

/**
 * Resolves the Fastify `trustProxy` option from TRUST_PROXY.
 *
 * Fastify only reads X-Forwarded-For when the peer that opened the connection
 * is trusted, and the throttler tracks `request.ip`, so this list decides who
 * may name the client. It must contain the reverse proxy and nothing else:
 * trusting every peer means any caller forges a fresh IP per request and walks
 * around the login limit. Unset means no proxy is trusted, which is the right
 * answer whenever the API is reachable directly.
 */
export function resolveTrustProxy(env: NodeJS.ProcessEnv = process.env): boolean | string[] {
  const value = env.TRUST_PROXY?.trim();
  if (value === undefined || value === '' || value === 'false') {
    return false;
  }
  if (value === 'true') {
    return true;
  }

  const entries = value
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
  if (entries.length === 0) {
    return false;
  }
  for (const entry of entries) {
    if (isProxyAddressEntry(entry)) {
      continue;
    }
    // The hop-count mode is deliberately unreachable: fastify 5.10.0 is
    // affected by GHSA-3m5p-2c4r-xxw2, where X-Forwarded-* can be spoofed
    // when trust is expressed as a number of hops.
    if (/^\d+$/.test(entry)) {
      throw new Error(
        'TRUST_PROXY does not accept a hop count (GHSA-3m5p-2c4r-xxw2). ' +
          'List the proxy addresses or CIDR ranges instead, for example "172.18.0.0/16".',
      );
    }
    throw new Error(
      `TRUST_PROXY entry "${entry}" is not an IP address, a CIDR range, or one of ${TRUST_PROXY_PRESETS.join(', ')}.`,
    );
  }
  return entries;
}

function isProxyAddressEntry(entry: string): boolean {
  if (TRUST_PROXY_PRESETS.includes(entry)) {
    return true;
  }
  const separator = entry.indexOf('/');
  if (separator === -1) {
    return isIP(entry) !== 0;
  }
  const family = isIP(entry.slice(0, separator));
  const prefix = entry.slice(separator + 1);
  if (family === 0 || !/^\d{1,3}$/.test(prefix)) {
    return false;
  }
  return Number(prefix) <= (family === 4 ? 32 : 128);
}

const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'];

// Request logs must never carry credentials. The serializers below already
// drop headers and bodies, and redaction keeps that true for anything logged
// by hand later. Bodies are redacted wholesale because redaction paths cannot
// be scoped per route, and /auth/login, /auth/refresh and /auth/change-password
// all post secrets.
const REDACTED_LOG_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["proxy-authorization"]',
  'res.headers["set-cookie"]',
  'req.body',
  'body',
  'password',
  'currentPassword',
  'newPassword',
  'accessToken',
  'refreshToken',
];

export function resolveLogLevel(env: NodeJS.ProcessEnv = process.env): string {
  const level = env.LOG_LEVEL?.trim().toLowerCase();
  if (level === undefined || level === '') {
    // `pnpm dev` interleaves both apps behind prefixes, so a line per request
    // is noise there. Warnings and errors still come through.
    return env.NODE_ENV === 'production' ? 'info' : 'warn';
  }
  if (!LOG_LEVELS.includes(level)) {
    throw new Error(`LOG_LEVEL must be one of ${LOG_LEVELS.join(', ')}, received "${level}".`);
  }
  return level;
}

// Structured request logging, JSON on stdout (the pino default).
export function resolveLoggerOptions(
  env: NodeJS.ProcessEnv = process.env,
): FastifyServerOptions['logger'] {
  return {
    level: resolveLogLevel(env),
    redact: { paths: REDACTED_LOG_PATHS, censor: '[redacted]' },
    serializers: {
      // The default serializer reports the socket address, which behind a
      // proxy is the proxy on every line. request.ip honours TRUST_PROXY.
      req: (request: FastifyRequest) => ({
        method: request.method,
        url: request.url,
        ip: request.ip,
      }),
    },
  };
}
