CREATE TABLE "style_books" (
	"id" uuid PRIMARY KEY NOT NULL,
	"external_reference_code" varchar(255) NOT NULL,
	"tenant_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"status" "entity_status" DEFAULT 'DRAFT' NOT NULL,
	"name" varchar(255) NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"tokens" jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "style_books" ADD CONSTRAINT "style_books_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "style_books_tenant_erc_uq" ON "style_books" USING btree ("tenant_id","external_reference_code");--> statement-breakpoint
CREATE UNIQUE INDEX "style_books_tenant_name_uq" ON "style_books" USING btree ("tenant_id","name");