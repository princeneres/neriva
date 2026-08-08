import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export const SITE_SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

// Slug is normalized to lowercase before pattern validation (spec 01-sites).
const lowercase = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.toLowerCase() : value;

export class CreateSiteDto {
  @ApiProperty({ maxLength: 255 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  @ApiProperty({
    maxLength: 100,
    pattern: SITE_SLUG_PATTERN.source,
    description: 'Unique per tenant; normalized to lowercase',
    example: 'main-site',
  })
  @Transform(lowercase)
  @IsString()
  @MaxLength(100)
  @Matches(SITE_SLUG_PATTERN)
  slug!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Stable code for idempotent upsert; generated when omitted' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  externalReferenceCode?: string;
}

export class UpdateSiteDto {
  @ApiPropertyOptional({ maxLength: 255 })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({
    maxLength: 100,
    pattern: SITE_SLUG_PATTERN.source,
    description: 'Unique per tenant; normalized to lowercase',
  })
  @IsOptional()
  @Transform(lowercase)
  @IsString()
  @MaxLength(100)
  @Matches(SITE_SLUG_PATTERN)
  slug?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  description?: string;
}
