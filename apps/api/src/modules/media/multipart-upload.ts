import type { MultipartFile } from '@fastify/multipart';
import { BadRequestException, PayloadTooLargeException } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';

export interface ParsedUpload {
  bytes: Buffer;
  fileName: string;
  contentType: string;
  fields: Record<string, string>;
}

function isFileTooLarge(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: unknown }).code === 'FST_REQ_FILE_TOO_LARGE'
  );
}

async function bufferFilePart(part: MultipartFile): Promise<Buffer> {
  try {
    return await part.toBuffer();
  } catch (error) {
    if (isFileTooLarge(error)) {
      throw new PayloadTooLargeException({ detail: 'File exceeds the maximum upload size' });
    }
    throw error;
  }
}

// Reads the upload request: exactly one file under the "file" field, plus any
// simple value fields (folderId, site). Manual parsing because multipart
// bodies never pass through the ValidationPipe.
export async function readUpload(req: FastifyRequest): Promise<ParsedUpload> {
  if (!req.isMultipart()) {
    throw new BadRequestException({ detail: 'Expected a multipart/form-data request' });
  }
  const fields: Record<string, string> = {};
  let file: Pick<ParsedUpload, 'bytes' | 'fileName' | 'contentType'> | null = null;
  for await (const part of req.parts()) {
    if (part.type === 'file') {
      if (file !== null || part.fieldname !== 'file') {
        // Drain unexpected file parts so the request stream finishes.
        part.file.resume();
        continue;
      }
      file = {
        bytes: await bufferFilePart(part),
        fileName: part.filename,
        contentType: part.mimetype,
      };
    } else if (typeof part.value === 'string') {
      fields[part.fieldname] = part.value;
    }
  }
  if (!file) {
    throw new BadRequestException({ detail: 'Multipart file field "file" is required' });
  }
  return { ...file, fields };
}
