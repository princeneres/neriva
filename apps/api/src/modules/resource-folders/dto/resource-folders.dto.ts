import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { RESOURCE_FOLDER_RESOURCES, type ResourceFolderResource } from '../../../db/schema';
import { ListQueryDto } from '../../../common/list-query.dto';

export class CreateResourceFolderDto {
  @ApiProperty({ maxLength: 255, example: 'Marketing' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  @ApiProperty({ enum: RESOURCE_FOLDER_RESOURCES, example: 'blocks' })
  @IsIn(RESOURCE_FOLDER_RESOURCES)
  resource!: ResourceFolderResource;

  @ApiPropertyOptional({ description: 'Stable code for idempotent upsert; generated when omitted' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  externalReferenceCode?: string;
}

export class UpdateResourceFolderDto {
  @ApiProperty({ maxLength: 255 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;
}

export class ListResourceFoldersQueryDto extends ListQueryDto {
  @ApiPropertyOptional({ enum: RESOURCE_FOLDER_RESOURCES })
  @IsOptional()
  @IsIn(RESOURCE_FOLDER_RESOURCES)
  resource?: ResourceFolderResource;
}
