import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class DeliveryPageQueryDto {
  @ApiPropertyOptional({ description: 'Page path within the site', default: '/' })
  @IsOptional()
  @IsString()
  path?: string;
}
