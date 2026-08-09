import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import { ApiExtraModels, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { FastifyReply } from 'fastify';
import { ApiDataResponse, ApiListResponse } from '../../common/api-envelope.decorators';
import { ListQueryDto } from '../../common/list-query.dto';
import { Public } from '../auth/auth.decorators';
import { DeliveryPageQueryDto } from './dto/delivery-query.dto';
import {
  DeliveredBlockDto,
  DeliveredPageListItemDto,
  DeliveredPageViewDto,
  DeliveredSiteDto,
} from './dto/delivery-response.dto';
import {
  DeliveryService,
  type DeliveredPageListItem,
  type DeliveredPageView,
  type DeliveredSite,
} from './delivery.service';

const SLUG_PARAM = { name: 'slug', description: 'Site slug' };

// Anonymous read-only delivery of PUBLISHED content (spec 10). The
// authenticated API remains the management side.
@ApiTags('delivery')
@ApiExtraModels(DeliveredBlockDto)
@Controller('public')
export class DeliveryController {
  constructor(private readonly deliveryService: DeliveryService) {}

  // Spec 13: the default site the web root serves; setting site.default
  // wins when its slug exists, otherwise the oldest site.
  @Public()
  @Get('site')
  @ApiDataResponse(DeliveredSiteDto)
  async defaultSite(): Promise<{ data: DeliveredSite }> {
    return { data: await this.deliveryService.getDefaultSite() };
  }

  @Public()
  @Get('sites/:slug/page')
  @ApiParam(SLUG_PARAM)
  @ApiDataResponse(DeliveredPageViewDto)
  async page(
    @Param('slug') slug: string,
    @Query() query: DeliveryPageQueryDto,
  ): Promise<{ data: DeliveredPageView }> {
    return { data: await this.deliveryService.getPage(slug, query.path ?? '/') };
  }

  @Public()
  @Get('sites/:slug/pages')
  @ApiParam(SLUG_PARAM)
  @ApiListResponse(DeliveredPageListItemDto)
  async pages(
    @Param('slug') slug: string,
    @Query() query: ListQueryDto,
  ): Promise<{ data: DeliveredPageListItem[]; meta: { cursor: string | null; limit: number } }> {
    const page = await this.deliveryService.listPages(slug, query);
    return { data: page.items, meta: { cursor: page.nextCursor, limit: page.limit } };
  }

  @Public()
  @Get('sites/:slug/style.css')
  @ApiParam(SLUG_PARAM)
  @ApiResponse({
    status: 200,
    description:
      'Design tokens of the most recently published Style Book as CSS custom properties on :root',
    content: { 'text/css': { schema: { type: 'string' } } },
  })
  async css(
    @Param('slug') slug: string,
    // passthrough: false takes over the response, bypassing the JSON
    // envelope interceptor for the raw text/css body.
    @Res({ passthrough: false }) reply: FastifyReply,
  ): Promise<void> {
    const css = await this.deliveryService.renderStyleCss(slug);
    await reply.type('text/css').send(css);
  }
}
