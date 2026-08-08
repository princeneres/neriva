import { describe, expect, it } from 'vitest';
import { apiUrl } from './api-url';

describe('apiUrl', () => {
  it('joins base and path with a single slash', () => {
    expect(apiUrl('/health')).toBe('http://localhost:3001/health');
    expect(apiUrl('health')).toBe('http://localhost:3001/health');
  });
});
