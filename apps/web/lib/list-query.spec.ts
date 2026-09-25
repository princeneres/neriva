import { describe, expect, it } from 'vitest';
import { buildListPath, isSearching } from './list-query';

describe('buildListPath', () => {
  it('returns the bare path when nothing is set', () => {
    expect(buildListPath('/blocks', { search: '', folder: null })).toBe('/blocks');
  });

  it('adds a search parameter', () => {
    expect(buildListPath('/blocks', { search: 'hero' })).toBe('/blocks?search=hero');
  });

  it('encodes accents and spaces', () => {
    expect(buildListPath('/pages', { search: 'página de contato' })).toBe(
      '/pages?search=p%C3%A1gina+de+contato',
    );
  });

  it('keeps parameters already present on the base path', () => {
    expect(buildListPath('/sites/abc/pages?limit=10', { search: 'contato' })).toBe(
      '/sites/abc/pages?limit=10&search=contato',
    );
  });

  it('combines several filters', () => {
    expect(buildListPath('/blocks', { folder: 'f1', search: 'hero' })).toBe(
      '/blocks?folder=f1&search=hero',
    );
  });

  it('drops a blank or whitespace-only value', () => {
    expect(buildListPath('/blocks', { search: '   ' })).toBe('/blocks');
    expect(buildListPath('/blocks', { search: undefined })).toBe('/blocks');
  });

  it('removes a parameter that the base path carried', () => {
    expect(buildListPath('/blocks?search=old', { search: '' })).toBe('/blocks');
  });

  it('trims a value so an unfiltered list and a trailing-space search share one key', () => {
    expect(buildListPath('/blocks', { search: ' hero ' })).toBe(
      buildListPath('/blocks', { search: 'hero' }),
    );
  });

  it('gives a filtered listing a different cache key than the unfiltered one', () => {
    expect(buildListPath('/blocks', { search: 'hero' })).not.toBe(
      buildListPath('/blocks', { search: '' }),
    );
  });
});

describe('isSearching', () => {
  it('is false for blank terms', () => {
    expect(isSearching('')).toBe(false);
    expect(isSearching('   ')).toBe(false);
    expect(isSearching(null)).toBe(false);
    expect(isSearching(undefined)).toBe(false);
  });

  it('is true once a real term is typed', () => {
    expect(isSearching('a')).toBe(true);
    expect(isSearching('  hero ')).toBe(true);
  });
});
