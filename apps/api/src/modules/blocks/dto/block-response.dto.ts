import { ApiProperty } from '@nestjs/swagger';
import { BLOCK_STATUSES, BlockSlotDto, type BlockStatus } from './blocks.dto';

export class BlockDto {
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

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  createdBy!: string | null;

  @ApiProperty({ enum: BLOCK_STATUSES })
  status!: BlockStatus;

  @ApiProperty()
  name!: string;

  @ApiProperty({ nullable: true })
  category!: string | null;

  @ApiProperty({ nullable: true })
  description!: string | null;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    description: 'JSON Schema (draft 2020-12) of the configurable props',
  })
  propsSchema!: Record<string, unknown>;

  @ApiProperty({ type: [BlockSlotDto] })
  slots!: BlockSlotDto[];

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'HTML template (spec 12); null means the registry rendering path',
  })
  html!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Template CSS, scoped at render time' })
  css!: string | null;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  folderId!: string | null;
}
