import { describe, expect, it } from 'vitest';
import { shouldSeedDemo } from './demo-seed.service';

describe('shouldSeedDemo', () => {
  it('allows demo data outside production by default', () => {
    expect(shouldSeedDemo({ NODE_ENV: 'development' })).toBe(true);
  });

  it('requires an explicit opt-in in production', () => {
    expect(shouldSeedDemo({ NODE_ENV: 'production' })).toBe(false);
    expect(shouldSeedDemo({ NODE_ENV: 'production', SEED_DEMO: 'false' })).toBe(false);
    expect(shouldSeedDemo({ NODE_ENV: 'production', SEED_DEMO: 'true' })).toBe(true);
  });
});
