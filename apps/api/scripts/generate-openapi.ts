import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { mkdirSync, writeFileSync } from 'node:fs';
import { stringify } from 'yaml';
import { AppModule } from '../src/app.module';

// The app is created but never initialized, so no DB connection is opened;
// a placeholder URL satisfies the DbModule factory.
process.env.DATABASE_URL ??= 'postgres://placeholder:placeholder@localhost:5432/placeholder';

// @nestjs/swagger emits OpenAPI 3.0; the project contract is 3.1
// (CLAUDE.md). The only 3.0-ism we produce is `nullable: true`, which 3.1
// replaced with union types, so upgrade the document in place.
function upgradeTo31(node: unknown): void {
  if (Array.isArray(node)) {
    node.forEach(upgradeTo31);
    return;
  }
  if (node === null || typeof node !== 'object') {
    return;
  }
  const obj = node as Record<string, unknown>;
  if (obj.nullable === true) {
    delete obj.nullable;
    if (typeof obj.type === 'string') {
      obj.type = [obj.type, 'null'];
    } else if (typeof obj.$ref === 'string') {
      const ref = obj.$ref;
      delete obj.$ref;
      obj.anyOf = [{ $ref: ref }, { type: 'null' }];
    }
  }
  Object.values(obj).forEach(upgradeTo31);
}

async function main(): Promise<void> {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter(), {
    logger: false,
  });

  const config = new DocumentBuilder()
    .setTitle('Neriva API')
    .setDescription(
      'Headless-first CMS REST API. Success responses use a { data, meta } envelope; ' +
        'errors are RFC 7807 problem+json. URL ids accept a UUID or erc:<externalReferenceCode>.',
    )
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  const upgraded = { ...document, openapi: '3.1.0' };
  upgradeTo31(upgraded.paths);
  upgradeTo31(upgraded.components);

  mkdirSync('../../docs/api', { recursive: true });
  writeFileSync(
    '../../docs/api/openapi.yaml',
    stringify(upgraded, { aliasDuplicateObjects: false }),
  );
  console.log('Wrote docs/api/openapi.yaml');
  process.exit(0);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
