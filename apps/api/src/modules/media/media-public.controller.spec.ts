import { describe, expect, it } from 'vitest';
import { encodeContentDispositionFilename, isInlineMediaType } from './media-public.controller';

describe('isInlineMediaType', () => {
  it('allows raster images inline', () => {
    expect(isInlineMediaType('image/png')).toBe(true);
    expect(isInlineMediaType('image/jpeg; charset=binary')).toBe(true);
  });

  it('keeps active and unknown content types as downloads', () => {
    expect(isInlineMediaType('image/svg+xml')).toBe(false);
    expect(isInlineMediaType('text/html')).toBe(false);
    expect(isInlineMediaType('application/octet-stream')).toBe(false);
  });
});

describe('content disposition filenames', () => {
  it('encodes RFC 5987 delimiters in download names', () => {
    expect(encodeContentDispositionFilename("report';(final).html")).toBe(
      'report%27%3B%28final%29.html',
    );
  });
});
