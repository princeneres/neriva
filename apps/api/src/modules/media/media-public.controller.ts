import { Controller, Get, NotFoundException, Param, Res } from '@nestjs/common';
import { ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { FastifyReply } from 'fastify';
import { Public } from '../auth/auth.decorators';
import { MediaService } from './media.service';
import { StorageService } from './storage.service';

// Only raster images are rendered inline. Everything else is downloaded so a
// user-uploaded HTML, SVG, XML or script cannot become an active document on
// the API origin. `nosniff` below also prevents browsers from overriding the
// stored type based on the bytes.
const INLINE_CONTENT_TYPES = new Set([
  'image/avif',
  'image/gif',
  'image/jpeg',
  'image/png',
  'image/webp',
]);

export function isInlineMediaType(contentType: string): boolean {
  return INLINE_CONTENT_TYPES.has(contentType.split(';', 1)[0]?.trim().toLowerCase() ?? '');
}

export function encodeContentDispositionFilename(fileName: string): string {
  // RFC 5987 attr-char excludes these characters even though
  // encodeURIComponent leaves them untouched.
  return encodeURIComponent(fileName).replace(
    /['()*]/g,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

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
    const response = reply
      .header('cache-control', 'public, max-age=31536000, immutable')
      .header('content-length', String(stored.sizeBytes))
      .header('x-content-type-options', 'nosniff')
      .type(file.contentType);
    if (!isInlineMediaType(file.contentType)) {
      response.header(
        'content-disposition',
        `attachment; filename*=UTF-8''${encodeContentDispositionFilename(file.fileName)}`,
      );
    }
    await response.send(stored.stream);
  }
}
