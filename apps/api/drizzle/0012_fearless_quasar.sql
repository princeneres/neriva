CREATE TYPE "public"."page_template_kind" AS ENUM('MASTER', 'STANDARD');--> statement-breakpoint
CREATE TABLE "page_templates" (
	"id" uuid PRIMARY KEY NOT NULL,
	"external_reference_code" varchar(255) NOT NULL,
	"tenant_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"name" varchar(255) NOT NULL,
	"kind" "page_template_kind" NOT NULL,
	"site_id" uuid,
	"tree" jsonb DEFAULT '{"blocks":[]}'::jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pages" ADD COLUMN "master_page_template_id" uuid;--> statement-breakpoint
ALTER TABLE "page_templates" ADD CONSTRAINT "page_templates_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_templates" ADD CONSTRAINT "page_templates_site_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "page_templates_tenant_erc_uq" ON "page_templates" USING btree ("tenant_id","external_reference_code");--> statement-breakpoint
CREATE UNIQUE INDEX "page_templates_tenant_name_uq" ON "page_templates" USING btree ("tenant_id","name");--> statement-breakpoint
ALTER TABLE "pages" ADD CONSTRAINT "pages_master_page_template_fk" FOREIGN KEY ("master_page_template_id") REFERENCES "public"."page_templates"("id") ON DELETE set null ON UPDATE no action;