CREATE TABLE "content_types" (
	"id" uuid PRIMARY KEY NOT NULL,
	"external_reference_code" varchar(255) NOT NULL,
	"tenant_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"name" varchar(255) NOT NULL,
	"description" text,
	"fields" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_entries" (
	"id" uuid PRIMARY KEY NOT NULL,
	"external_reference_code" varchar(255) NOT NULL,
	"tenant_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"status" "entity_status" DEFAULT 'DRAFT' NOT NULL,
	"custom_fields" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"content_type_id" uuid NOT NULL,
	"site_id" uuid,
	"title" varchar(255) NOT NULL,
	"values" jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "content_types" ADD CONSTRAINT "content_types_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_entries" ADD CONSTRAINT "content_entries_content_type_id_content_types_id_fk" FOREIGN KEY ("content_type_id") REFERENCES "public"."content_types"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_entries" ADD CONSTRAINT "content_entries_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_entries" ADD CONSTRAINT "content_entries_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "content_types_tenant_erc_uq" ON "content_types" USING btree ("tenant_id","external_reference_code");--> statement-breakpoint
CREATE UNIQUE INDEX "content_types_tenant_name_uq" ON "content_types" USING btree ("tenant_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "content_entries_tenant_erc_uq" ON "content_entries" USING btree ("tenant_id","external_reference_code");--> statement-breakpoint
CREATE INDEX "content_entries_tenant_type_idx" ON "content_entries" USING btree ("tenant_id","content_type_id");--> statement-breakpoint
CREATE INDEX "content_entries_tenant_site_idx" ON "content_entries" USING btree ("tenant_id","site_id");