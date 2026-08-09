import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiParam, ApiTags } from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';
import { ApiDataResponse, ApiListResponse } from '../../common/api-envelope.decorators';
import { CurrentUser } from '../auth/auth.decorators';
import type { AuthenticatedUser } from '../auth/auth.types';
import { RequirePermission } from '../roles/require-permission.decorator';
import { MediaFileDto, MediaFolderDto } from './dto/media-response.dto';
import {
  CreateMediaFolderDto,
  ListMediaFilesQueryDto,
  ListMediaFoldersQueryDto,
  UpdateMediaFileDto,
  UpdateMediaFolderDto,
} from './dto/media.dto';
import {
  MediaService,
  toMediaFileResponse,
  type MediaFileResponse,
  type MediaFolderRow,
} from './media.service';
import { readUpload } from './multipart-upload';

const ID_PARAM = { name: 'id', description: 'UUID or erc:<externalReferenceCode>' };

interface ListMeta {
  cursor: string | null;
  limit: number;
}

@ApiTags('media')
@ApiBearerAuth()
@Controller('media')
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  // ---- folders ----

  @Get('folders')
  @ApiListResponse(MediaFolderDto)
  @RequirePermission('media:read')
  async listFolders(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListMediaFoldersQueryDto,
  ): Promise<{ data: MediaFolderRow[]; meta: ListMeta }> {
    const page = await this.mediaService.listFolders(user.tenantId, query);
    return { data: page.items, meta: { cursor: page.nextCursor, limit: page.limit } };
  }

  @Post('folders')
  @ApiDataResponse(MediaFolderDto, { status: 201 })
  @RequirePermission('media:create')
  async createFolder(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateMediaFolderDto,
  ): Promise<{ data: MediaFolderRow }> {
    return { data: await this.mediaService.createFolder(user.tenantId, user.id, dto) };
  }

  @Patch('folders/:id')
  @ApiParam(ID_PARAM)
  @ApiDataResponse(MediaFolderDto)
  @RequirePermission('media:update')
  async updateFolder(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateMediaFolderDto,
  ): Promise<{ data: MediaFolderRow }> {
    return { data: await this.mediaService.updateFolder(user.tenantId, id, dto) };
  }

  @Delete('folders/:id')
  @ApiParam(ID_PARAM)
  @RequirePermission('media:delete')
  @HttpCode(204)
  async deleteFolder(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<void> {
    await this.mediaService.deleteFolder(user.tenantId, id);
  }

  // ---- files ----

  @Get('files')
  @ApiListResponse(MediaFileDto)
  @RequirePermission('media:read')
  async listFiles(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListMediaFilesQueryDto,
  ): Promise<{ data: MediaFileResponse[]; meta: ListMeta }> {
    const page = await this.mediaService.listFiles(user.tenantId, query);
    return {
      data: page.items.map(toMediaFileResponse),
      meta: { cursor: page.nextCursor, limit: page.limit },
    };
  }

  @Post('files')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: { type: 'string', format: 'binary' },
        folderId: {
          type: 'string',
          description: 'Target folder (UUID or erc:<externalReferenceCode>); omit for the root',
        },
        site: {
          type: 'string',
          description:
            'Site ref (UUID or erc:<externalReferenceCode>); without folderId the file lands ' +
            "in that site's default folder Sites/<site name> (auto-created)",
        },
      },
    },
  })
  @ApiDataResponse(MediaFileDto, { status: 201 })
  @RequirePermission('media:create')
  async uploadFile(
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: FastifyRequest,
  ): Promise<{ data: MediaFileResponse }> {
    const upload = await readUpload(req);
    const row = await this.mediaService.uploadFile(user.tenantId, user.id, {
      fileName: upload.fileName,
      contentType: upload.contentType,
      bytes: upload.bytes,
      folderId: upload.fields.folderId,
      site: upload.fields.site,
    });
    return { data: toMediaFileResponse(row) };
  }

  @Get('files/:id')
  @ApiParam(ID_PARAM)
  @ApiDataResponse(MediaFileDto)
  @RequirePermission('media:read')
  async getFile(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<{ data: MediaFileResponse }> {
    return { data: toMediaFileResponse(await this.mediaService.getFileByRef(user.tenantId, id)) };
  }

  @Patch('files/:id')
  @ApiParam(ID_PARAM)
  @ApiDataResponse(MediaFileDto)
  @RequirePermission('media:update')
  async updateFile(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateMediaFileDto,
  ): Promise<{ data: MediaFileResponse }> {
    return {
      data: toMediaFileResponse(await this.mediaService.updateFile(user.tenantId, id, dto)),
    };
  }

  @Delete('files/:id')
  @ApiParam(ID_PARAM)
  @RequirePermission('media:delete')
  @HttpCode(204)
  async deleteFile(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<void> {
    await this.mediaService.deleteFile(user.tenantId, id);
  }
}
