import { Controller, Get, NotFoundException, Param, Res } from '@nestjs/common';
import { ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { FastifyReply } from 'fastify';
import { Public } from '../auth/auth.decorators';
import { MediaService } from './media.service';
import { StorageService } from './storage.service';

// Anonymous streaming of uploaded bytes (spec 11). The management API stays
// behind auth; this is the content URL embedded in pages.
@ApiTags('media')
@Controller('public/media')
export class MediaPublicController {
  constructor(
    private readonly mediaService: MediaService,
    private readonly storage: StorageService,
  ) {}

  @Public()
  @Get(':id/:fileName')
  @ApiParam({ name: 'id', description: 'File UUID or erc:<externalReferenceCode>' })
  @ApiParam({ name: 'fileName', description: 'Cosmetic; any value is accepted' })
  @ApiResponse({
    status: 200,
    description: 'The file bytes with the stored content type and immutable cache headers',
    content: { 'application/octet-stream': { schema: { type: 'string', format: 'binary' } } },
  })
  async stream(
    @Param('id') id: string,
    @Param('fileName') _fileName: string,
    // passthrough: false takes over the response, bypassing the JSON
    // envelope interceptor for the raw byte stream.
    @Res({ passthrough: false }) reply: FastifyReply,
  ): Promise<void> {
    const file = await this.mediaService.getPublicFileByRef(id);
    const stored = await this.storage.read(file.storageKey);
    if (!stored) {
      throw new NotFoundException({ detail: 'Media file not found' });
    }
    await reply
      .header('cache-control', 'public, max-age=31536000, immutable')
      .header('content-length', String(stored.sizeBytes))
      .type(file.contentType)
      .send(stored.stream);
  }
}
