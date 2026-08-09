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
import { ListQueryDto } from '../../../common/list-query.dto';

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
      'HTML template with {{prop}} interpolation, data-nv-* bindings and data-nv-slot placeholders (spec 12); null keeps the registry rendering path',
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

  @ApiPropertyOptional({ description: 'Stable code for idempotent upsert; generated when omitted' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  externalReferenceCode?: string;
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
}

export class ListBlocksQueryDto extends ListQueryDto {
  @ApiPropertyOptional({ enum: BLOCK_STATUSES })
  @IsOptional()
  @IsIn(BLOCK_STATUSES)
  status?: BlockStatus;
}
