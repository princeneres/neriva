import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';
import { ListQueryDto } from '../../../common/list-query.dto';

export const CONTENT_ENTRY_STATUSES = ['DRAFT', 'PUBLISHED', 'ARCHIVED'] as const;
export type ContentEntryStatus = (typeof CONTENT_ENTRY_STATUSES)[number];

const REF_DESCRIPTION = 'UUID or erc:<externalReferenceCode>';

export class CreateContentEntryDto {
  @ApiProperty({ description: `Content type reference: ${REF_DESCRIPTION}` })
  @IsString()
  @IsNotEmpty()
  contentType!: string;

  @ApiPropertyOptional({
    description: `Site reference: ${REF_DESCRIPTION}; omitted = tenant-wide entry`,
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  site?: string;

  @ApiProperty({ maxLength: 255 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title!: string;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    description: 'Field values keyed by the content type field keys',
  })
  @IsObject()
  values!: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Stable code for idempotent upsert; generated when omitted' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  externalReferenceCode?: string;
}

export class UpdateContentEntryDto {
  @ApiPropertyOptional({ maxLength: 255 })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title?: string;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    description: 'Replaces the full values payload; validated against the content type fields',
  })
  @IsOptional()
  @IsObject()
  values?: Record<string, unknown>;

  @ApiPropertyOptional({
    nullable: true,
    description: `Site reference: ${REF_DESCRIPTION}; null detaches the entry to tenant-wide`,
  })
  // @IsOptional also skips validation for explicit null, which is the
  // intended "detach from site" signal here.
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  site?: string | null;
}

export class ListContentEntriesQueryDto extends ListQueryDto {
  @ApiPropertyOptional({ description: `Filter by content type: ${REF_DESCRIPTION}` })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  contentType?: string;

  @ApiPropertyOptional({ description: `Filter by site: ${REF_DESCRIPTION}` })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  site?: string;
}
