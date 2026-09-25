import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { SearchableListQueryDto } from '../../../common/list-query.dto';

export const BLOCK_STATUSES = ['DRAFT', 'PUBLISHED', 'ARCHIVED'] as const;
export type BlockStatus = (typeof BLOCK_STATUSES)[number];

export class BlockSlotDto {
  @ApiProperty({ example: 'main', description: 'Unique slot name, ^[a-z][a-z0-9-]*$' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({
    type: [String],
    description: 'Block ERCs allowed in this slot; unrestricted when omitted',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowedBlocks?: string[];
}

export class CreateBlockDto {
  @ApiProperty({ example: 'Hero Banner' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  @ApiPropertyOptional({ example: 'content' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  category?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    description: 'JSON Schema (draft 2020-12) describing the configurable props',
    example: { type: 'object', properties: { title: { type: 'string' } } },
  })
  @IsObject()
  propsSchema!: Record<string, unknown>;

  @ApiPropertyOptional({ type: [BlockSlotDto], description: 'Named slots, defaults to []' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BlockSlotDto)
  slots?: BlockSlotDto[];

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description:
      'Active HTML source used by the shared Block renderer. Supports escaped {{prop}} interpolation, data-nv bindings, slots, and declared collection runtimes.',
  })
  @IsOptional()
  @IsString()
  html?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: 'Template CSS, scoped to the block wrapper at render time; may use var(--nv-*)',
  })
  @IsOptional()
  @IsString()
  css?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description:
      'Active JavaScript source. It runs only in the Block renderer sandbox and can request declared runtime actions through the safe message bridge.',
  })
  @IsOptional()
  @IsString()
  js?: string | null;

  @ApiPropertyOptional({ description: 'Stable code for idempotent upsert; generated when omitted' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  externalReferenceCode?: string;

  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true })
  @IsOptional()
  @IsString()
  folderId?: string | null;
}

export class UpdateBlockDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  category?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    description: 'JSON Schema (draft 2020-12) describing the configurable props',
  })
  @IsOptional()
  @IsObject()
  propsSchema?: Record<string, unknown>;

  @ApiPropertyOptional({ type: [BlockSlotDto], description: 'Replaces the full slot list' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BlockSlotDto)
  slots?: BlockSlotDto[];

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: 'HTML template (spec 12); explicit null removes the template',
  })
  @IsOptional()
  @IsString()
  html?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: 'Template CSS; explicit null removes it',
  })
  @IsOptional()
  @IsString()
  css?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description:
      'JavaScript source executed only in the Block renderer sandbox; explicit null removes it',
  })
  @IsOptional()
  @IsString()
  js?: string | null;

  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true })
  @IsOptional()
  @IsString()
  folderId?: string | null;
}

export class ListBlocksQueryDto extends SearchableListQueryDto {
  @ApiPropertyOptional({ enum: BLOCK_STATUSES })
  @IsOptional()
  @IsIn(BLOCK_STATUSES)
  status?: BlockStatus;

  @ApiPropertyOptional({ format: 'uuid', description: 'Only blocks assigned to this folder' })
  @IsOptional()
  @IsString()
  folder?: string;
}
