import { ApiProperty } from '@nestjs/swagger';

export const PAGE_STATUSES = ['DRAFT', 'PUBLISHED', 'ARCHIVED'] as const;
export type PageStatus = (typeof PAGE_STATUSES)[number];

export class PageDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  externalReferenceCode!: string;

  @ApiProperty({ format: 'uuid' })
  tenantId!: string;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;

  @ApiProperty({ format: 'uuid', nullable: true })
  createdBy!: string | null;

  @ApiProperty({ enum: PAGE_STATUSES })
  status!: PageStatus;

  @ApiProperty({ format: 'uuid' })
  siteId!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty({ description: 'Unique per site, ^/[a-z0-9/-]*$' })
  path!: string;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    description: 'Recursive tree of block instances: { blocks: [...] }',
  })
  tree!: Record<string, unknown>;

  @ApiProperty({ type: 'object', additionalProperties: true })
  customFields!: Record<string, unknown>;
}
