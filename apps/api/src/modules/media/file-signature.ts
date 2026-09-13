import { BadRequestException } from '@nestjs/common';

const PNG = Buffer.from('89504e470d0a1a0a', 'hex');
const JPEG = Buffer.from('ffd8ff', 'hex');
const GIF87A = Buffer.from('GIF87a', 'ascii');
const GIF89A = Buffer.from('GIF89a', 'ascii');
const PDF = Buffer.from('%PDF-', 'ascii');
const ZIP = Buffer.from('504b0304', 'hex');
const OLE = Buffer.from('d0cf11e0a1b11ae1', 'hex');

const ALLOWED_CONTENT_TYPES = new Set([
  'application/json',
  'application/msword',
  'application/pdf',
  'application/vnd.ms-excel',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/zip',
  'image/avif',
  'image/gif',
  'image/jpeg',
  'image/png',
  'image/webp',
  'text/csv',
  'text/plain',
]);

function startsWith(bytes: Buffer, signature: Buffer, offset = 0): boolean {
  return bytes.subarray(offset, offset + signature.length).equals(signature);
}

function isWebp(bytes: Buffer): boolean {
  return (
    startsWith(bytes, Buffer.from('RIFF', 'ascii')) &&
    startsWith(bytes, Buffer.from('WEBP', 'ascii'), 8)
  );
}

function isAvif(bytes: Buffer): boolean {
  if (!startsWith(bytes, Buffer.from('ftyp', 'ascii'), 4)) {
    return false;
  }
  const brand = bytes.subarray(8, 12).toString('ascii');
  return brand === 'avif' || brand === 'avis';
}

function isUtf8Text(bytes: Buffer): boolean {
  if (bytes.includes(0)) {
    return false;
  }
  const text = bytes.toString('utf8');
  return Buffer.from(text, 'utf8').equals(bytes);
}

function isZip(bytes: Buffer): boolean {
  return startsWith(bytes, ZIP) || startsWith(bytes, Buffer.from('PK\x05\x06', 'binary'));
}

function hasSignature(contentType: string, bytes: Buffer): boolean {
  switch (contentType) {
    case 'image/png':
      return startsWith(bytes, PNG);
    case 'image/jpeg':
      return startsWith(bytes, JPEG);
    case 'image/gif':
      return startsWith(bytes, GIF87A) || startsWith(bytes, GIF89A);
    case 'image/webp':
      return isWebp(bytes);
    case 'image/avif':
      return isAvif(bytes);
    case 'application/pdf':
      return startsWith(bytes, PDF);
    case 'application/msword':
    case 'application/vnd.ms-excel':
    case 'application/vnd.ms-powerpoint':
      return startsWith(bytes, OLE);
    case 'application/vnd.openxmlformats-officedocument.presentationml.presentation':
    case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
    case 'application/zip':
      return isZip(bytes);
    case 'application/json':
    case 'text/csv':
    case 'text/plain':
      return isUtf8Text(bytes);
    default:
      return false;
  }
}

export function normalizeUploadContentType(contentType: string): string {
  return contentType.split(';', 1)[0]?.trim().toLowerCase() ?? '';
}

// Client-provided MIME types are hints, not proof. Keep the accepted set
// deliberately small and require a matching file signature before bytes are
// persisted. This prevents an uploaded script or HTML document from being
// disguised as a safe image or document type.
export function validateUploadSignature(contentTypeHeader: string, bytes: Buffer): string {
  const contentType = normalizeUploadContentType(contentTypeHeader);
  if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
    throw new BadRequestException({
      detail: `Unsupported media type: ${contentType || 'unknown'}`,
    });
  }
  if (!hasSignature(contentType, bytes)) {
    throw new BadRequestException({
      detail: 'File content does not match its declared media type',
    });
  }
  return contentType;
}
