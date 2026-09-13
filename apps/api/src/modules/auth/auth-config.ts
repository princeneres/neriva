const MIN_ACCESS_SECRET_LENGTH = 32;
const INSECURE_ACCESS_SECRETS = new Set(['change-me', 'dev-insecure-access-secret']);

export function assertProductionAuthConfig(env: NodeJS.ProcessEnv = process.env): void {
  if (env.NODE_ENV !== 'production') {
    return;
  }

  const secret = env.JWT_ACCESS_SECRET?.trim();
  if (!secret) {
    throw new Error('JWT_ACCESS_SECRET must be set in production');
  }
  if (secret.length < MIN_ACCESS_SECRET_LENGTH || INSECURE_ACCESS_SECRETS.has(secret)) {
    throw new Error(
      `JWT_ACCESS_SECRET must be a random value with at least ${MIN_ACCESS_SECRET_LENGTH} characters in production`,
    );
  }
}
