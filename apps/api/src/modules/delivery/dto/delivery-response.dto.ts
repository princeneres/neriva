import { ApiProperty, ApiPropertyOptional, getSchemaPath } from '@nestjs/swagger';

export class DeliveredSiteDto {
  @ApiProperty()
  name!: string;

  @ApiProperty()
  slug!: string;
}

export class DeliveredSiteNavPageDto {
  @ApiProperty()
  title!: string;

  @ApiProperty()
  path!: string;
}

export class DeliveredPageViewSiteDto extends DeliveredSiteDto {
  @ApiProperty({
    type: [DeliveredSiteNavPageDto],
    description:
      "The site's own published pages (title/path only), capped at 50, for a header/footer block's data-nv-nav",
  })
  pages!: DeliveredSiteNavPageDto[];
}

export class DeliveredPageDto {
  @ApiProperty()
  title!: string;

  @ApiProperty()
  path!: string;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    description: 'Recursive tree of block instances: { blocks: [...] }',
  })
  tree!: Record<string, unknown>;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;
}

export class DeliveredBlockSlotDto {
  @ApiProperty()
  name!: string;

  @ApiPropertyOptional({ type: [String] })
  allowedBlocks?: string[];
}

export class DeliveredBlockDto {
  @ApiProperty()
  name!: string;

  @ApiProperty({ type: String, nullable: true })
  category!: string | null;

  @ApiProperty({ type: [DeliveredBlockSlotDto] })
  slots!: DeliveredBlockSlotDto[];

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Active HTML template consumed by the shared block renderer',
  })
  html!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Template CSS, scoped at render time' })
  css!: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Active JavaScript source, executed only in the Block renderer sandbox',
  })
  js!: string | null;

  @ApiProperty({ enum: ['NATIVE', 'CUSTOM'] })
  templateSource!: 'NATIVE' | 'CUSTOM';
}

export class DeliveredPageViewDto {
  @ApiProperty({ type: DeliveredPageViewSiteDto })
  site!: DeliveredPageViewSiteDto;

  @ApiProperty({ type: DeliveredPageDto })
  page!: DeliveredPageDto;

  @ApiProperty({
    type: 'object',
    additionalProperties: { $ref: getSchemaPath(DeliveredBlockDto) },
    description: 'Map of block ERC to its definition, for every block referenced in the tree',
  })
  blocks!: Record<string, DeliveredBlockDto>;
}

export class DeliveredPageListItemDto {
  @ApiProperty()
  title!: string;

  @ApiProperty()
  path!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;
}

export class DeliveredContentEntryDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  externalReferenceCode!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty({
    description: "External reference code of the entry's content type",
  })
  contentType!: string;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    description: 'Field values keyed by the content type field keys',
  })
  values!: Record<string, unknown>;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;
}
