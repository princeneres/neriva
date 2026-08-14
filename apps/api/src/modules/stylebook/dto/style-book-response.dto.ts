import { ApiProperty } from '@nestjs/swagger';

export class StyleBookDto {
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

  @ApiProperty({ enum: ['DRAFT', 'PUBLISHED', 'ARCHIVED'] })
  status!: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

  @ApiProperty()
  name!: string;

  @ApiProperty({ description: 'Incremented on each publish' })
  version!: number;

  @ApiProperty({
    description: 'Flat map of token name to CSS value',
    type: 'object',
    additionalProperties: { type: 'string' },
  })
  tokens!: Record<string, string>;

  @ApiProperty({
    description: 'Optional dark-mode overrides, same shape as tokens',
    type: 'object',
    additionalProperties: { type: 'string' },
    nullable: true,
  })
  tokensDark!: Record<string, string> | null;
}
