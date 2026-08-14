import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { ListQueryDto } from '../../../common/list-query.dto';

const REF_DESCRIPTION = 'UUID or erc:<externalReferenceCode>';

export class CreateMediaFolderDto {
  @ApiProperty({ maxLength: 255 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  @ApiPropertyOptional({ description: `Parent folder (${REF_DESCRIPTION}); omit for the root` })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  parent?: string;

  @ApiPropertyOptional({ description: 'Stable code for idempotent upsert; generated when omitted' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  externalReferenceCode?: string;
}

export class UpdateMediaFolderDto {
  @ApiPropertyOptional({ maxLength: 255 })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({
    nullable: true,
    description: `New parent folder (${REF_DESCRIPTION}); null moves to the root`,
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  parent?: string | null;
}

export class UpdateMediaFileDto {
  @ApiPropertyOptional({ maxLength: 255, description: 'Display name; sanitized on save' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  fileName?: string;

  @ApiPropertyOptional({ nullable: true, maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  alt?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description: `Target folder (${REF_DESCRIPTION}); null moves to the root`,
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  folderId?: string | null;
}

export class ListMediaFoldersQueryDto extends ListQueryDto {
  @ApiPropertyOptional({
    description: `Parent folder (${REF_DESCRIPTION}) or "root" (default): children listing`,
  })
  @IsOptional()
  @IsString()
  parent?: string;
}

export class ListMediaFilesQueryDto extends ListQueryDto {
  @ApiPropertyOptional({
    description: `Folder (${REF_DESCRIPTION}) or "root" (default): folder content listing`,
  })
  @IsOptional()
  @IsString()
  folder?: string;

  @ApiPropertyOptional({
    description: 'Case-insensitive file name search across every folder; ignores folder when set',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  search?: string;
}
