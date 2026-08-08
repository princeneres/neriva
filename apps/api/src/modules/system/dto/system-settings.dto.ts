import { ApiProperty } from '@nestjs/swagger';
import { IsDefined } from 'class-validator';

export class UpsertSystemSettingDto {
  @ApiProperty({ description: 'Any JSON value (object, array, string, number, boolean)' })
  @IsDefined()
  value!: unknown;
}

export class SystemSettingDto {
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

  @ApiProperty({
    example: 'site.name',
    description: 'Unique per tenant, pattern ^[a-z][a-z0-9.-]*$',
  })
  key!: string;

  @ApiProperty({ description: 'Any JSON value' })
  value!: unknown;
}
