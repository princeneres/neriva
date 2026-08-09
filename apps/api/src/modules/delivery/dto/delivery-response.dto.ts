import { ApiProperty, ApiPropertyOptional, getSchemaPath } from '@nestjs/swagger';

export class DeliveredSiteDto {
  @ApiProperty()
  name!: string;

  @ApiProperty()
  slug!: string;
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
}

export class DeliveredPageViewDto {
  @ApiProperty({ type: DeliveredSiteDto })
  site!: DeliveredSiteDto;

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
