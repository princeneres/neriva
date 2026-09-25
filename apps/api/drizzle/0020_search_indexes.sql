-- Hand written migration (no schema change, so drizzle-kit does not own it).
-- Server side admin search: accent folding, trigram indexes for short names,
-- Portuguese full text search for the large JSONB payloads.
--
-- Both extensions are "trusted" in PostgreSQL 13+, so the database owner can
-- create them without superuser rights. They ship with the embedded
-- PostgreSQL 16 used by `pnpm dev` and with postgres:16-alpine used by the
-- Testcontainers e2e suite.
CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA public;
--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;
--> statement-breakpoint
-- unaccent() is declared STABLE because its dictionary can be reloaded, and an
-- index expression must be IMMUTABLE. This wrapper pins the dictionary and the
-- schema, which makes the result reproducible; reindex if the dictionary is
-- ever changed.
CREATE OR REPLACE FUNCTION public.nv_search_text(value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
STRICT
AS $fn$ SELECT lower(public.unaccent('public.unaccent'::regdictionary, value)) $fn$;
--> statement-breakpoint
-- Search document: the columns a list endpoint searches, folded into one
-- normalized string. array_to_string skips NULL elements, so nullable columns
-- need no coalesce. Keep the argument lists below in sync with the column
-- lists passed to trigramSearch()/fullTextSearch() in the services, otherwise
-- the expression indexes stop matching and the searches fall back to scans.
CREATE OR REPLACE FUNCTION public.nv_search_doc(VARIADIC parts text[])
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $fn$ SELECT public.nv_search_text(array_to_string(parts, ' ')) $fn$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.nv_search_tsv(VARIADIC parts text[])
RETURNS tsvector
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $fn$ SELECT to_tsvector('portuguese'::regconfig, public.nv_search_doc(VARIADIC parts)) $fn$;
--> statement-breakpoint
-- The <% operator reads its cutoff from pg_trgm.word_similarity_threshold.
-- The 0.6 default drops a one letter slip in a short word ("nerva" against
-- "Neriva" scores 0.57); 0.5 catches those while still rejecting unrelated
-- words. It applies to new sessions, so the pool the API opens after the
-- migration picks it up. Skipped, with the 0.6 default left in place, when the
-- migration role does not own the database.
DO $do$
BEGIN
  EXECUTE format(
    'ALTER DATABASE %I SET pg_trgm.word_similarity_threshold = 0.5',
    current_database()
  );
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'pg_trgm.word_similarity_threshold left at its default; typo tolerance is stricter';
END
$do$;
--> statement-breakpoint
-- Trigram indexes. gin_trgm_ops serves both the unaccented LIKE '%term%'
-- substring match and the <% word similarity match used for typo tolerance.
CREATE INDEX IF NOT EXISTS "pages_search_idx"
  ON "pages" USING gin (public.nv_search_doc("title", "path") public.gin_trgm_ops);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blocks_search_idx"
  ON "blocks" USING gin (public.nv_search_doc("name", "category", "description") public.gin_trgm_ops);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "content_entries_search_idx"
  ON "content_entries" USING gin (public.nv_search_doc("title") public.gin_trgm_ops);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_search_idx"
  ON "users" USING gin (public.nv_search_doc("display_name", "email") public.gin_trgm_ops);
--> statement-breakpoint
-- Full text indexes over the JSONB payloads, where stemming and multi word
-- queries matter more than substring matching.
CREATE INDEX IF NOT EXISTS "content_entries_fts_idx"
  ON "content_entries" USING gin (public.nv_search_tsv("title", "values"::text));
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "object_records_fts_idx"
  ON "object_records" USING gin (public.nv_search_tsv("data"::text));
