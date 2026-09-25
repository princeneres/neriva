import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT } from './pagination';
import { MAX_SEARCH_TERM_LENGTH } from './search';

export class ListQueryDto {
  @ApiPropertyOptional({ minimum: 1, maximum: MAX_PAGE_LIMIT, default: DEFAULT_PAGE_LIMIT })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_LIMIT)
  limit?: number;

  @ApiPropertyOptional({ description: 'Opaque cursor from the previous page meta' })
  @IsOptional()
  @IsString()
  cursor?: string;
}

// Opt-in base for the list endpoints that filter server side. It is a separate
// class instead of a field on ListQueryDto so an endpoint never advertises a
// search parameter it ignores: the public delivery listing, for example, keeps
// its own already published `q`.
export class SearchableListQueryDto extends ListQueryDto {
  @ApiPropertyOptional({
    maxLength: MAX_SEARCH_TERM_LENGTH,
    description:
      'Free text search. Accent and case insensitive; blank or whitespace-only is ignored.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_SEARCH_TERM_LENGTH)
  search?: string;
}
