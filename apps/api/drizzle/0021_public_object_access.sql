-- Opt-in anonymous access for Object definitions (spec 05).
-- The column is NOT NULL DEFAULT 'none', so every row that exists when this
-- runs stays private. No migration may ever publish data nobody reviewed.
CREATE TYPE "public"."object_public_access" AS ENUM('none', 'read', 'read-write');--> statement-breakpoint
ALTER TABLE "object_definitions" ADD COLUMN "public_access" "object_public_access" DEFAULT 'none' NOT NULL;
