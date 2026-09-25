import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { CONTENT_FIELD_TYPES, type ContentFieldType } from '../../../db/schema';
import { FIELD_KEY_PATTERN } from '../content-field.validation';
import { SearchableListQueryDto } from '../../../common/list-query.dto';

export class ContentFieldDto {
  @ApiProperty({ pattern: FIELD_KEY_PATTERN.source, example: 'headline' })
  @IsString()
  @Matches(FIELD_KEY_PATTERN)
  key!: string;

  @ApiProperty({ example: 'Headline' })
  @IsString()
  @IsNotEmpty()
  label!: string;

  @ApiProperty({ enum: CONTENT_FIELD_TYPES })
  @IsIn(CONTENT_FIELD_TYPES)
  type!: ContentFieldType;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  required?: boolean;
}

export class CreateContentTypeDto {
  @ApiProperty({ maxLength: 255 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Stable code for idempotent upsert; generated when omitted' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  externalReferenceCode?: string;

  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true })
  @IsOptional()
  @IsString()
  folderId?: string | null;

  @ApiProperty({ type: [ContentFieldDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ContentFieldDto)
  fields!: ContentFieldDto[];
}

export class UpdateContentTypeDto {
  @ApiPropertyOptional({ maxLength: 255 })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ type: [ContentFieldDto], description: 'Replaces the full field list' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ContentFieldDto)
  fields?: ContentFieldDto[];

  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true })
  @IsOptional()
  @IsString()
  folderId?: string | null;
}

export class ListContentTypesQueryDto extends SearchableListQueryDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Only content types assigned to this folder',
  })
  @IsOptional()
  @IsString()
  folder?: string;
}
