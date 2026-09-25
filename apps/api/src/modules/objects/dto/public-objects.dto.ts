import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject } from 'class-validator';
import { ObjectFieldDto } from './object-definitions.dto';

// 'none' is unreachable on this surface: a private definition answers 404.
const PUBLIC_ACCESS_MODES = ['read', 'read-write'] as const;

// Request body for an anonymous write. Deliberately narrower than
// CreateObjectRecordDto: no externalReferenceCode, so a visitor cannot claim
// the stable code an integration addresses a record by.
export class PublicCreateObjectRecordDto {
  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    description: 'Field values keyed by the definition field keys',
  })
  @IsObject()
  data!: Record<string, unknown>;
}

export class PublicUpdateObjectRecordDto {
  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    description: 'Replaces the full data payload; validated against the definition fields',
  })
  @IsObject()
  data!: Record<string, unknown>;
}

export class PublicObjectDefinitionDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  externalReferenceCode!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  pluralName!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  description!: string | null;

  @ApiProperty({
    enum: PUBLIC_ACCESS_MODES,
    description: 'Whether anonymous callers may only read this object or also write to it',
  })
  publicAccess!: (typeof PUBLIC_ACCESS_MODES)[number];

  @ApiProperty({ type: [ObjectFieldDto] })
  fields!: ObjectFieldDto[];
}

export class PublicObjectRecordDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  externalReferenceCode!: string;

  @ApiProperty({ type: 'object', additionalProperties: true })
  data!: Record<string, unknown>;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;
}
