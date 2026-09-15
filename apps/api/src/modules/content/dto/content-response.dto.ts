import { ApiProperty } from '@nestjs/swagger';
import { CONTENT_ENTRY_STATUSES, type ContentEntryStatus } from './content-entries.dto';
import { ContentFieldDto } from './content-types.dto';

export class ContentTypeDto {
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

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  createdBy!: string | null;

  @ApiProperty()
  name!: string;

  @ApiProperty({ nullable: true })
  description!: string | null;

  @ApiProperty({ type: [ContentFieldDto] })
  fields!: ContentFieldDto[];

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  folderId!: string | null;
}

export class ContentEntryDto {
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

  @ApiProperty({ enum: CONTENT_ENTRY_STATUSES })
  status!: ContentEntryStatus;

  @ApiProperty({ format: 'uuid' })
  contentTypeId!: string;

  @ApiProperty({ format: 'uuid', nullable: true, description: 'null = tenant-wide entry' })
  siteId!: string | null;

  @ApiProperty()
  title!: string;

  @ApiProperty({ type: 'object', additionalProperties: true })
  values!: Record<string, unknown>;

  @ApiProperty({ type: 'object', additionalProperties: true })
  customFields!: Record<string, unknown>;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  folderId!: string | null;
}
