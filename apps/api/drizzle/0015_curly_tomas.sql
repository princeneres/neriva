CREATE TYPE "public"."resource_folder_resource" AS ENUM('blocks', 'content-types', 'content-entries', 'objects');--> statement-breakpoint
CREATE TABLE "resource_folders" (
	"id" uuid PRIMARY KEY NOT NULL,
	"external_reference_code" varchar(255) NOT NULL,
	"tenant_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"name" varchar(255) NOT NULL,
	"resource" "resource_folder_resource" NOT NULL
);
--> statement-breakpoint
ALTER TABLE "blocks" ADD COLUMN "folder_id" uuid;--> statement-breakpoint
ALTER TABLE "object_definitions" ADD COLUMN "folder_id" uuid;--> statement-breakpoint
ALTER TABLE "content_types" ADD COLUMN "folder_id" uuid;--> statement-breakpoint
ALTER TABLE "content_entries" ADD COLUMN "folder_id" uuid;--> statement-breakpoint
ALTER TABLE "resource_folders" ADD CONSTRAINT "resource_folders_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "resource_folders_tenant_resource_name_uq" ON "resource_folders" USING btree ("tenant_id","resource","name");--> statement-breakpoint
ALTER TABLE "blocks" ADD CONSTRAINT "blocks_folder_id_resource_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."resource_folders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "object_definitions" ADD CONSTRAINT "object_definitions_folder_id_resource_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."resource_folders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_types" ADD CONSTRAINT "content_types_folder_id_resource_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."resource_folders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_entries" ADD CONSTRAINT "content_entries_folder_id_resource_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."resource_folders"("id") ON DELETE set null ON UPDATE no action;