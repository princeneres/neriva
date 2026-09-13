import { BadRequestException, ConflictException } from '@nestjs/common';

export function expectedUpdatedAt(value: string | undefined): Date | undefined {
  if (value === undefined) {
    return undefined;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new BadRequestException({ detail: 'expectedUpdatedAt must be a valid ISO date' });
  }
  return date;
}

export function staleResource(resource: string): ConflictException {
  return new ConflictException({
    detail: `${resource} changed after it was loaded; reload it before saving`,
    code: 'STALE_RESOURCE',
  });
}
