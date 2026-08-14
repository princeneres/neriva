import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { ListQueryDto } from '../../../common/list-query.dto';

// Anonymous callers reach this endpoint, so the search term is bounded to
// keep the ILIKE pattern from growing unbounded.
const MAX_SEARCH_LENGTH = 200;

export class DeliveryPageQueryDto {
  @ApiPropertyOptional({ description: 'Page path within the site', default: '/' })
  @IsOptional()
  @IsString()
  path?: string;
}

export class DeliveryContentEntriesQueryDto extends ListQueryDto {
  @ApiPropertyOptional({
    description:
      'Filter by content type: UUID or erc:<externalReferenceCode>; an unknown content type yields an empty list',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  contentType?: string;

  @ApiPropertyOptional({
    maxLength: MAX_SEARCH_LENGTH,
    description:
      'Case-insensitive substring search over the entry title and the text of its values payload',
  })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_SEARCH_LENGTH)
  q?: string;
}
