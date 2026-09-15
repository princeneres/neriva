import { ApiProperty } from '@nestjs/swagger';
import { RESOURCE_FOLDER_RESOURCES, type ResourceFolderResource } from '../../../db/schema';

export class ResourceFolderDto {
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

  @ApiProperty({ enum: RESOURCE_FOLDER_RESOURCES })
  resource!: ResourceFolderResource;

  @ApiProperty()
  name!: string;
}
