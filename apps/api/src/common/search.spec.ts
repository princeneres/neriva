import { PgDialect } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';
import { blocks, contentEntries } from '../db/schema';
import {
  escapeLikePattern,
  fullTextOrTrigramSearch,
  fullTextSearch,
  normalizeSearchTerm,
  substringSearch,
  trigramSearch,
} from './search';
import type { SQL } from 'drizzle-orm';

const dialect = new PgDialect();

function render(condition: SQL): { sql: string; params: unknown[] } {
  const query = dialect.sqlToQuery(condition);
  return { sql: query.sql, params: query.params };
}

describe('normalizeSearchTerm', () => {
  it('drops terms that carry no filter', () => {
    expect(normalizeSearchTerm(undefined)).toBeUndefined();
    expect(normalizeSearchTerm(null)).toBeUndefined();
    expect(normalizeSearchTerm('')).toBeUndefined();
    expect(normalizeSearchTerm('   ')).toBeUndefined();
    expect(normalizeSearchTerm('\t\n ')).toBeUndefined();
  });

  it('trims and collapses whitespace', () => {
    expect(normalizeSearchTerm('  página  de   contato ')).toBe('página de contato');
  });

  it('keeps accents and case for the database to fold', () => {
    expect(normalizeSearchTerm('Página')).toBe('Página');
  });
});

describe('escapeLikePattern', () => {
  it('escapes the three characters LIKE treats as special', () => {
    expect(escapeLikePattern('100% de_conto')).toBe('100\\% de\\_conto');
    expect(escapeLikePattern('a\\b')).toBe('a\\\\b');
  });

  it('leaves an ordinary term untouched', () => {
    expect(escapeLikePattern('contato')).toBe('contato');
  });
});

describe('search conditions', () => {
  it('binds the term as a parameter instead of inlining it', () => {
    const { sql, params } = render(trigramSearch("o'brien", [blocks.name]));
    expect(sql).not.toContain("o'brien");
    expect(params).toContain("o'brien");
  });

  it('wraps a substring search in the shared normalization function', () => {
    const { sql, params } = render(substringSearch('contato', [blocks.name, blocks.description]));
    expect(sql).toContain('nv_search_doc("blocks"."name", "blocks"."description")');
    expect(sql).toContain('LIKE nv_search_text(');
    expect(params).toContain('%contato%');
  });

  it('adds a word similarity branch for trigram searches', () => {
    const { sql } = render(trigramSearch('contato', [blocks.name]));
    expect(sql).toContain('LIKE nv_search_text(');
    expect(sql).toContain('<%');
  });

  it('escapes wildcards inside the generated LIKE pattern', () => {
    const { params } = render(substringSearch('50%_off', [blocks.name]));
    expect(params).toContain('%50\\%\\_off%');
  });

  it('builds a websearch tsquery against the tsvector expression', () => {
    const { sql, params } = render(fullTextSearch('agência brasileira', [contentEntries.title]));
    expect(sql).toContain('nv_search_tsv("content_entries"."title")');
    expect(sql).toContain("websearch_to_tsquery('portuguese', nv_search_text(");
    expect(params).toContain('agência brasileira');
  });

  it('combines full text with a trigram fallback', () => {
    const { sql } = render(
      fullTextOrTrigramSearch('contato', {
        trigramColumns: [contentEntries.title],
        textColumns: [contentEntries.title],
      }),
    );
    expect(sql).toContain('nv_search_doc(');
    expect(sql).toContain('nv_search_tsv(');
  });
});
