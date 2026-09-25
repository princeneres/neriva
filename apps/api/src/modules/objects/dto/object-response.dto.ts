import { ApiProperty } from '@nestjs/swagger';
import { OBJECT_PUBLIC_ACCESS_MODES, type ObjectPublicAccess } from '../../../db/schema';
import { ObjectFieldDto } from './object-definitions.dto';

export class ObjectDefinitionDto {
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

  @ApiProperty()
  pluralName!: string;

  @ApiProperty({ nullable: true })
  description!: string | null;

  @ApiProperty({ type: [ObjectFieldDto] })
  fields!: ObjectFieldDto[];

  @ApiProperty({
    enum: OBJECT_PUBLIC_ACCESS_MODES,
    description: 'Anonymous access mode; "none" means the object is private',
  })
  publicAccess!: ObjectPublicAccess;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  folderId!: string | null;
}

export class ObjectRecordDto {
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

  @ApiProperty({ format: 'uuid' })
  objectDefinitionId!: string;

  @ApiProperty({ type: 'object', additionalProperties: true })
  data!: Record<string, unknown>;
}
