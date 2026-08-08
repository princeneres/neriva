CREATE TABLE "pages" (
	"id" uuid PRIMARY KEY NOT NULL,
	"external_reference_code" varchar(255) NOT NULL,
	"tenant_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"status" "entity_status" DEFAULT 'DRAFT' NOT NULL,
	"custom_fields" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"site_id" uuid NOT NULL,
	"title" varchar(255) NOT NULL,
	"path" varchar(255) NOT NULL,
	"tree" jsonb DEFAULT '{"blocks":[]}'::jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pages" ADD CONSTRAINT "pages_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pages" ADD CONSTRAINT "pages_site_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "pages_tenant_erc_uq" ON "pages" USING btree ("tenant_id","external_reference_code");--> statement-breakpoint
CREATE UNIQUE INDEX "pages_site_path_uq" ON "pages" USING btree ("site_id","path");