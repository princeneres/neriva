import { ApiProperty } from '@nestjs/swagger';

export class MediaFolderDto {
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

  @ApiProperty({ format: 'uuid', nullable: true, description: 'null = library root' })
  parentId!: string | null;

  @ApiProperty({
    format: 'uuid',
    nullable: true,
    description: 'Set when this is a site default folder',
  })
  siteId!: string | null;
}

export class MediaFileDto {
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

  @ApiProperty({ format: 'uuid', nullable: true, description: 'null = library root' })
  folderId!: string | null;

  @ApiProperty()
  fileName!: string;

  @ApiProperty()
  contentType!: string;

  @ApiProperty()
  sizeBytes!: number;

  @ApiProperty({ nullable: true, description: 'Accessibility text for images' })
  alt!: string | null;

  @ApiProperty({ description: 'Public content URL: /public/media/<id>/<fileName>' })
  url!: string;

  @ApiProperty({ type: 'object', additionalProperties: true })
  customFields!: Record<string, unknown>;
}
