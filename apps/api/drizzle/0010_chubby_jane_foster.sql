CREATE TABLE "media_folders" (
	"id" uuid PRIMARY KEY NOT NULL,
	"external_reference_code" varchar(255) NOT NULL,
	"tenant_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"name" varchar(255) NOT NULL,
	"parent_id" uuid,
	"site_id" uuid,
	CONSTRAINT "media_folders_tenant_parent_name_uq" UNIQUE NULLS NOT DISTINCT("tenant_id","parent_id","name")
);
--> statement-breakpoint
CREATE TABLE "media_files" (
	"id" uuid PRIMARY KEY NOT NULL,
	"external_reference_code" varchar(255) NOT NULL,
	"tenant_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"custom_fields" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"folder_id" uuid,
	"file_name" varchar(255) NOT NULL,
	"content_type" varchar(127) NOT NULL,
	"size_bytes" integer NOT NULL,
	"storage_key" varchar(255) NOT NULL,
	"alt" varchar(500),
	CONSTRAINT "media_files_storage_key_unique" UNIQUE("storage_key")
);
--> statement-breakpoint
ALTER TABLE "media_folders" ADD CONSTRAINT "media_folders_parent_id_media_folders_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."media_folders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_folders" ADD CONSTRAINT "media_folders_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_folders" ADD CONSTRAINT "media_folders_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_files" ADD CONSTRAINT "media_files_folder_id_media_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."media_folders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_files" ADD CONSTRAINT "media_files_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "media_folders_tenant_erc_uq" ON "media_folders" USING btree ("tenant_id","external_reference_code");--> statement-breakpoint
CREATE UNIQUE INDEX "media_files_tenant_erc_uq" ON "media_files" USING btree ("tenant_id","external_reference_code");--> statement-breakpoint
CREATE INDEX "media_files_tenant_folder_idx" ON "media_files" USING btree ("tenant_id","folder_id");