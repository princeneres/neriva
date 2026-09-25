import { or, sql, type SQL, type SQLWrapper } from 'drizzle-orm';

// Longest accepted search term. Long enough for a pasted title, short enough
// that a hostile caller cannot build a pathological trigram query.
export const MAX_SEARCH_TERM_LENGTH = 200;

// Text search configuration used by the full text searches. The content is
// Brazilian Portuguese; the stemmer ships with PostgreSQL core, no extension.
// Inlined rather than bound, so the regconfig argument resolves at plan time
// exactly like the one baked into the index expression.
const TEXT_SEARCH_CONFIG = sql.raw("'portuguese'");

// Trims and collapses whitespace. An empty term means "no filter", never
// "match nothing", so callers can pass a raw query parameter straight in.
export function normalizeSearchTerm(raw?: string | null): string | undefined {
  const collapsed = raw?.trim().replace(/\s+/g, ' ');
  return collapsed ? collapsed : undefined;
}

// Postgres treats \, % and _ as special inside a LIKE/ILIKE pattern
// (backslash is the default escape character); a raw user search term must
// have all three escaped so it matches as a literal substring instead of a
// wildcard pattern.
export function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

// nv_search_doc(...) from drizzle/0020_search_indexes.sql: the columns folded
// into one lowercased, accent stripped string. The expression indexes are
// built over exactly this call, so the column list here must match the one in
// the migration for the index to be used.
function document(columns: readonly SQLWrapper[]): SQL {
  return sql`nv_search_doc(${sql.join(
    columns.map((column) => sql`${column}`),
    sql`, `,
  )})`;
}

function tsvector(columns: readonly SQLWrapper[]): SQL {
  return sql`nv_search_tsv(${sql.join(
    columns.map((column) => sql`${column}`),
    sql`, `,
  )})`;
}

// Accent insensitive substring match. No similarity branch, so it never needs
// an index to stay predictable; used on the small metadata tables.
export function substringSearch(term: string, columns: readonly SQLWrapper[]): SQL {
  const doc = document(columns);
  return sql`${doc} LIKE nv_search_text(${`%${escapeLikePattern(term)}%`})`;
}

// Substring match OR trigram word similarity, both served by the same
// gin_trgm_ops index. The similarity branch is what tolerates a typo:
// `<%` compares the term against the best matching word extent of the
// document, using pg_trgm.word_similarity_threshold (0.6 by default).
export function trigramSearch(term: string, columns: readonly SQLWrapper[]): SQL {
  const doc = document(columns);
  // or() only returns undefined when given zero conditions.
  return or(
    sql`${doc} LIKE nv_search_text(${`%${escapeLikePattern(term)}%`})`,
    sql`nv_search_text(${term}) <% ${doc}`,
  ) as SQL;
}

// Portuguese full text search over a JSONB heavy document: stemming (preço
// finds preços), implicit AND between words, quoted phrases and -negation,
// all from websearch_to_tsquery, which never throws on user input.
export function fullTextSearch(term: string, columns: readonly SQLWrapper[]): SQL {
  return sql`${tsvector(columns)} @@ websearch_to_tsquery(${TEXT_SEARCH_CONFIG}, nv_search_text(${term}))`;
}

// A term made only of stopwords ("de", "a") compiles to an empty tsquery that
// matches nothing, and full text search never matches word fragments. Pairing
// it with a trigram search over the short columns keeps both cases useful.
export function fullTextOrTrigramSearch(
  term: string,
  options: { trigramColumns: readonly SQLWrapper[]; textColumns: readonly SQLWrapper[] },
): SQL {
  return or(
    trigramSearch(term, options.trigramColumns),
    fullTextSearch(term, options.textColumns),
  ) as SQL;
}
