import { describe, expect, it } from 'vitest';
import { sanitizeFileName } from './file-name';

describe('sanitizeFileName', () => {
  it('keeps a plain name untouched', () => {
    expect(sanitizeFileName('logo.png')).toBe('logo.png');
  });

  it('keeps only the last segment of a unix path', () => {
    expect(sanitizeFileName('../etc/passwd')).toBe('passwd');
    expect(sanitizeFileName('/var/tmp/photo.jpg')).toBe('photo.jpg');
  });

  it('keeps only the last segment of a windows path', () => {
    expect(sanitizeFileName('C:\\Users\\me\\report.pdf')).toBe('report.pdf');
  });

  it('strips control characters', () => {
    expect(sanitizeFileName('he\u0000llo\u001f.t\u007fxt')).toBe('hello.txt');
  });

  it('trims surrounding whitespace', () => {
    expect(sanitizeFileName('  spaced.png  ')).toBe('spaced.png');
  });

  it('falls back to "file" when nothing usable remains', () => {
    expect(sanitizeFileName('')).toBe('file');
    expect(sanitizeFileName('   ')).toBe('file');
    expect(sanitizeFileName('a/b/')).toBe('file');
    expect(sanitizeFileName('.')).toBe('file');
    expect(sanitizeFileName('..')).toBe('file');
  });

  it('bounds the result to 255 characters', () => {
    expect(sanitizeFileName('x'.repeat(300))).toHaveLength(255);
  });
});
