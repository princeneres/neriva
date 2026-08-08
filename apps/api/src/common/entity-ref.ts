import { BadRequestException } from '@nestjs/common';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface EntityRef {
  kind: 'id' | 'erc';
  value: string;
}

// URL ids accept either a UUID or erc:<externalReferenceCode>
// (CLAUDE.md API convention).
export function parseEntityRef(raw: string): EntityRef {
  if (raw.startsWith('erc:')) {
    const value = decodeURIComponent(raw.slice(4));
    if (!value) {
      throw new BadRequestException({ detail: 'Empty externalReferenceCode in erc: reference' });
    }
    return { kind: 'erc', value };
  }
  if (!UUID_RE.test(raw)) {
    throw new BadRequestException({
      detail: `Invalid id "${raw}": expected a UUID or erc:<externalReferenceCode>`,
    });
  }
  return { kind: 'id', value: raw };
}
