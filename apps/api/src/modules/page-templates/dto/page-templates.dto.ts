import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { SearchableListQueryDto } from '../../../common/list-query.dto';

export const PAGE_TEMPLATE_KINDS = ['MASTER', 'STANDARD'] as const;
export type PageTemplateKindValue = (typeof PAGE_TEMPLATE_KINDS)[number];

const REF_DESCRIPTION = 'UUID or erc:<externalReferenceCode>';

const TREE_API_PROPERTY = {
  type: 'object' as const,
  additionalProperties: true,
  description:
    'Recursive tree of block instances, same shape as a page tree. A MASTER tree must ' +
    'contain the reserved drop zone { "block": "__page_content__" } exactly once; a ' +
    'STANDARD tree must not contain it.',
};

export class CreatePageTemplateDto {
  @ApiProperty({ maxLength: 255, example: 'Default Master' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  @ApiProperty({ enum: PAGE_TEMPLATE_KINDS })
  @IsIn(PAGE_TEMPLATE_KINDS)
  kind!: PageTemplateKindValue;

  @ApiPropertyOptional({
    description: `Site reference: ${REF_DESCRIPTION}; omitted = available to every site`,
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  site?: string;

  @ApiPropertyOptional({
    ...TREE_API_PROPERTY,
    default: 'default drop zone for MASTER, empty for STANDARD',
  })
  @IsOptional()
  @IsObject()
  tree?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Stable code for idempotent upsert; generated when omitted' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  externalReferenceCode?: string;
}

export class UpdatePageTemplateDto {
  @ApiPropertyOptional({
    format: 'date-time',
    description: 'The updatedAt value returned when the template was loaded',
  })
  @IsOptional()
  @IsDateString()
  expectedUpdatedAt?: string;

  @ApiPropertyOptional({ maxLength: 255 })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional(TREE_API_PROPERTY)
  @IsOptional()
  @IsObject()
  tree?: Record<string, unknown>;
}

export class ListPageTemplatesQueryDto extends SearchableListQueryDto {
  @ApiPropertyOptional({ enum: PAGE_TEMPLATE_KINDS })
  @IsOptional()
  @IsIn(PAGE_TEMPLATE_KINDS)
  kind?: PageTemplateKindValue;
}
