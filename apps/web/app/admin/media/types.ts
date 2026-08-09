import {
  IconFile,
  IconFileMusic,
  IconFileSpreadsheet,
  IconFileText,
  IconFileTypeDoc,
  IconFileTypePdf,
  IconFileZip,
  IconMovie,
  type Icon,
} from '@tabler/icons-react';

// Media DTOs typed locally: the media API module is built in parallel against
// spec 11, so the generated contracts do not carry these schemas yet.
export interface MediaFolder {
  id: string;
  externalReferenceCode: string;
  name: string;
  parentId: string | null;
  siteId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MediaFile {
  id: string;
  externalReferenceCode: string;
  folderId: string | null;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  alt: string | null;
  url: string;
  createdAt: string;
  updatedAt: string;
}

export const MEDIA_HELP =
  'The shared library of images and documents you upload once and reuse across pages and sites';

export const ALT_TEXT_HELP =
  'A short description of the image, read aloud by screen readers and shown when the image cannot load';

export const SITE_FOLDER_HELP =
  'Each site gets its own default folder under "Sites": uploads made at the library root while that site is selected land there automatically';

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

export function isImage(contentType: string): boolean {
  return contentType.startsWith('image/');
}

export function fileExtension(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  return dot > 0 ? fileName.slice(dot + 1).toUpperCase() : 'FILE';
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  const units = ['KB', 'MB', 'GB'];
  let value = bytes;
  let unit = -1;
  do {
    value /= 1024;
    unit += 1;
  } while (value >= 1024 && unit < units.length - 1);
  return `${value >= 10 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`;
}

// Icon shown for non-image files, picked by content type.
export function fileTypeIcon(contentType: string): Icon {
  if (contentType === 'application/pdf') {
    return IconFileTypePdf;
  }
  if (contentType.startsWith('video/')) {
    return IconMovie;
  }
  if (contentType.startsWith('audio/')) {
    return IconFileMusic;
  }
  if (contentType.startsWith('text/') && !contentType.includes('csv')) {
    return IconFileText;
  }
  if (
    contentType.includes('spreadsheet') ||
    contentType.includes('excel') ||
    contentType.includes('csv')
  ) {
    return IconFileSpreadsheet;
  }
  if (contentType.includes('word') || contentType.includes('opendocument.text')) {
    return IconFileTypeDoc;
  }
  if (
    contentType.includes('zip') ||
    contentType.includes('compressed') ||
    contentType.includes('tar')
  ) {
    return IconFileZip;
  }
  return IconFile;
}
