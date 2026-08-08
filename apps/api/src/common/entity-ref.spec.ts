import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { parseEntityRef } from './entity-ref';

describe('parseEntityRef', () => {
  it('accepts a UUID', () => {
    const id = '01936b2a-0000-7000-8000-000000000000';
    expect(parseEntityRef(id)).toEqual({ kind: 'id', value: id });
  });

  it('accepts erc: references and URL-decodes them', () => {
    expect(parseEntityRef('erc:my-code')).toEqual({ kind: 'erc', value: 'my-code' });
    expect(parseEntityRef('erc:with%20space')).toEqual({ kind: 'erc', value: 'with space' });
  });

  it('rejects non-uuid, non-erc input', () => {
    expect(() => parseEntityRef('123')).toThrow(BadRequestException);
    expect(() => parseEntityRef('erc:')).toThrow(BadRequestException);
  });
});
