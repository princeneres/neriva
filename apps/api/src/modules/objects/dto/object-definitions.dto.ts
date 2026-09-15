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
import { OBJECT_FIELD_TYPES, type ObjectFieldType } from '../../../db/schema';
import { FIELD_KEY_PATTERN } from '../object-field.validation';
import { ListQueryDto } from '../../../common/list-query.dto';

export class ObjectFieldDto {
  @ApiProperty({ pattern: FIELD_KEY_PATTERN.source, example: 'firstName' })
  @IsString()
  @Matches(FIELD_KEY_PATTERN)
  key!: string;

  @ApiProperty({ example: 'First name' })
  @IsString()
  @IsNotEmpty()
  label!: string;

  @ApiProperty({ enum: OBJECT_FIELD_TYPES })
  @IsIn(OBJECT_FIELD_TYPES)
  type!: ObjectFieldType;

  @ApiProperty()
  @IsBoolean()
  required!: boolean;

  @ApiPropertyOptional({ type: [String], description: 'Allowed values; picklist fields only' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  options?: string[];
}

export class CreateObjectDefinitionDto {
  @ApiProperty({ maxLength: 255 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  @ApiProperty({ maxLength: 255 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  pluralName!: string;

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

  @ApiProperty({ type: [ObjectFieldDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ObjectFieldDto)
  fields!: ObjectFieldDto[];
}

export class UpdateObjectDefinitionDto {
  @ApiPropertyOptional({ maxLength: 255 })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({ maxLength: 255 })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  pluralName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ type: [ObjectFieldDto], description: 'Replaces the full field list' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ObjectFieldDto)
  fields?: ObjectFieldDto[];

  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true })
  @IsOptional()
  @IsString()
  folderId?: string | null;
}

export class ListObjectDefinitionsQueryDto extends ListQueryDto {
  @ApiPropertyOptional({ format: 'uuid', description: 'Only objects assigned to this folder' })
  @IsOptional()
  @IsString()
  folder?: string;
}
