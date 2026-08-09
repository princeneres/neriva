import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsObject, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export const PAGE_PATH_PATTERN = /^\/[a-z0-9/-]*$/;

const REF_DESCRIPTION = 'UUID or erc:<externalReferenceCode>';

const TREE_API_PROPERTY = {
  type: 'object' as const,
  additionalProperties: true,
  description:
    'Recursive tree of block instances: { blocks: [{ block: <block ERC>, props, slots }] }. ' +
    'Validated against each referenced block definition on every write.',
  example: {
    blocks: [
      {
        block: 'hero-banner',
        props: { title: 'Welcome' },
        slots: { main: [{ block: 'text', props: { body: 'Hello' } }] },
      },
    ],
  },
};

export class CreatePageDto {
  @ApiProperty({ maxLength: 255, example: 'Home' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title!: string;

  @ApiProperty({
    maxLength: 255,
    pattern: PAGE_PATH_PATTERN.source,
    description: 'Unique per site',
    example: '/home',
  })
  @IsString()
  @MaxLength(255)
  @Matches(PAGE_PATH_PATTERN)
  path!: string;

  @ApiPropertyOptional({ ...TREE_API_PROPERTY, default: { blocks: [] } })
  @IsOptional()
  @IsObject()
  tree?: Record<string, unknown>;

  @ApiPropertyOptional({
    description: `Master page template reference (MASTER kind): ${REF_DESCRIPTION}`,
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  masterPageTemplateId?: string;

  @ApiPropertyOptional({
    description:
      `Page template reference (STANDARD kind): ${REF_DESCRIPTION}. Its tree is copied ` +
      'once as the initial tree on create; ignored when tree is also given. Not persisted ' +
      'as an ongoing relationship.',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  templateId?: string;

  @ApiPropertyOptional({ description: 'Stable code for idempotent upsert; generated when omitted' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  externalReferenceCode?: string;
}

export class UpdatePageDto {
  @ApiPropertyOptional({ maxLength: 255 })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title?: string;

  @ApiPropertyOptional({
    maxLength: 255,
    pattern: PAGE_PATH_PATTERN.source,
    description: 'Unique per site',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  @Matches(PAGE_PATH_PATTERN)
  path?: string;

  @ApiPropertyOptional(TREE_API_PROPERTY)
  @IsOptional()
  @IsObject()
  tree?: Record<string, unknown>;

  @ApiPropertyOptional({
    nullable: true,
    description:
      `Master page template reference (MASTER kind): ${REF_DESCRIPTION}; ` +
      'null reverts to the tenant default resolution',
  })
  // @IsOptional also skips validation for explicit null, the intended
  // "revert to tenant default" signal here (same trick as content-entries'
  // nullable site field).
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  masterPageTemplateId?: string | null;
}
