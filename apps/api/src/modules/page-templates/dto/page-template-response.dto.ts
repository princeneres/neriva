import { ApiProperty } from '@nestjs/swagger';
import { PAGE_TEMPLATE_KINDS, type PageTemplateKindValue } from './page-templates.dto';

export class PageTemplateDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  externalReferenceCode!: string;

  @ApiProperty({ format: 'uuid' })
  tenantId!: string;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;

  @ApiProperty({ format: 'uuid', nullable: true })
  createdBy!: string | null;

  @ApiProperty()
  name!: string;

  @ApiProperty({ enum: PAGE_TEMPLATE_KINDS })
  kind!: PageTemplateKindValue;

  @ApiProperty({ format: 'uuid', nullable: true, description: 'null = available to every site' })
  siteId!: string | null;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    description: 'Recursive tree of block instances: { blocks: [...] }',
  })
  tree!: Record<string, unknown>;

  @ApiProperty({
    description:
      'Whether this is the tenant-wide fallback master, resolved for pages that set no ' +
      'masterPageTemplateId of their own (spec 14). Meaningful for kind = MASTER only.',
  })
  isDefault!: boolean;
}
