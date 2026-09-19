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
    description: 'Active HTML source consumed by the shared Block renderer',
  })
  html!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Template CSS, scoped at render time' })
  css!: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Active JavaScript source, executed only in the renderer sandbox',
  })
  js!: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Immutable HTML source supplied by Neriva for a native block',
  })
  nativeHtml!: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Immutable CSS source supplied by Neriva for a native block',
  })
  nativeCss!: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Immutable JavaScript source supplied by Neriva for a native block',
  })
  nativeJs!: string | null;

  @ApiProperty({
    enum: ['NATIVE', 'CUSTOM'],
    description: 'Whether active source equals the native baseline',
  })
  templateSource!: 'NATIVE' | 'CUSTOM';

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  folderId!: string | null;
}
