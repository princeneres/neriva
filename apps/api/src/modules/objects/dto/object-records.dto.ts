import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsObject, IsOptional, IsString, Matches } from 'class-validator';
import { SearchableListQueryDto } from '../../../common/list-query.dto';

export class CreateObjectRecordDto {
  @ApiPropertyOptional({ description: 'Stable code for idempotent upsert; generated when omitted' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  externalReferenceCode?: string;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    description: 'Field values keyed by the definition field keys',
  })
  @IsObject()
  data!: Record<string, unknown>;
}

export class UpdateObjectRecordDto {
  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    description: 'Replaces the full data payload; validated against the definition fields',
  })
  @IsOptional()
  @IsObject()
  data?: Record<string, unknown>;
}

export class ListObjectRecordsQueryDto extends SearchableListQueryDto {
  @ApiPropertyOptional({
    description:
      "Sort by a definition field key; prefix with '-' for descending. Not combinable with cursor (v1 limitation).",
    example: '-createdOn',
  })
  @IsOptional()
  @IsString()
  @Matches(/^-?[a-z][a-zA-Z0-9]*$/)
  sort?: string;
}
