import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { validateUploadSignature } from './file-signature';

function expectBadRequest(action: () => unknown, detail: string): void {
  try {
    action();
    throw new Error('Expected a BadRequestException');
  } catch (error) {
    expect(error).toBeInstanceOf(BadRequestException);
    expect((error as BadRequestException).getResponse()).toMatchObject({ detail });
  }
}

describe('validateUploadSignature', () => {
  it('accepts matching image and document signatures', () => {
    expect(validateUploadSignature('image/png', Buffer.from('89504e470d0a1a0a', 'hex'))).toBe(
      'image/png',
    );
    expect(validateUploadSignature('application/pdf', Buffer.from('%PDF-1.7'))).toBe(
      'application/pdf',
    );
    expect(validateUploadSignature('text/plain; charset=utf-8', Buffer.from('hello'))).toBe(
      'text/plain',
    );
  });

  it('rejects a mismatched signature', () => {
    expectBadRequest(
      () => validateUploadSignature('image/png', Buffer.from('<script>alert(1)</script>')),
      'File content does not match its declared media type',
    );
  });

  it('rejects unsupported active document types', () => {
    expectBadRequest(
      () => validateUploadSignature('text/html', Buffer.from('<h1>unsafe</h1>')),
      'Unsupported media type: text/html',
    );
  });

  it('rejects binary data declared as text', () => {
    expectBadRequest(
      () => validateUploadSignature('text/plain', Buffer.from([0, 1, 2])),
      'File content does not match its declared media type',
    );
  });
});
