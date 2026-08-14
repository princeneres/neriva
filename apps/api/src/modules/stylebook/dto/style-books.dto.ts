import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';

const TOKENS_API_PROPERTY = {
  description:
    'Flat map of token name to CSS value. Names match ^[a-z][a-z0-9-]*$; values are non-empty strings.',
  type: 'object' as const,
  additionalProperties: { type: 'string' as const },
  example: { 'color-primary': '#cc3d47', 'space-4': '1rem' },
};

const TOKENS_DARK_API_PROPERTY = {
  ...TOKENS_API_PROPERTY,
  description:
    'Optional dark-mode overrides, same shape as tokens. A key absent here falls back to a ' +
    'derived dark variant (spec 06), never to nothing.',
};

export class CreateStyleBookDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty(TOKENS_API_PROPERTY)
  @IsObject()
  tokens!: Record<string, string>;

  @ApiPropertyOptional(TOKENS_DARK_API_PROPERTY)
  @IsOptional()
  @IsObject()
  tokensDark?: Record<string, string>;

  @ApiPropertyOptional({ description: 'Stable code for idempotent upsert; generated when omitted' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  externalReferenceCode?: string;
}

export class UpdateStyleBookDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @ApiPropertyOptional(TOKENS_API_PROPERTY)
  @IsOptional()
  @IsObject()
  tokens?: Record<string, string>;

  @ApiPropertyOptional(TOKENS_DARK_API_PROPERTY)
  @IsOptional()
  @IsObject()
  tokensDark?: Record<string, string>;
}
