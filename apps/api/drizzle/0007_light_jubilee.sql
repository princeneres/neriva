CREATE TABLE "object_definitions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"external_reference_code" varchar(255) NOT NULL,
	"tenant_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"name" varchar(255) NOT NULL,
	"plural_name" varchar(255) NOT NULL,
	"description" text,
	"fields" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "object_records" (
	"id" uuid PRIMARY KEY NOT NULL,
	"external_reference_code" varchar(255) NOT NULL,
	"tenant_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"object_definition_id" uuid NOT NULL,
	"data" jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "object_definitions" ADD CONSTRAINT "object_definitions_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "object_records" ADD CONSTRAINT "object_records_object_definition_id_object_definitions_id_fk" FOREIGN KEY ("object_definition_id") REFERENCES "public"."object_definitions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "object_records" ADD CONSTRAINT "object_records_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "object_definitions_tenant_erc_uq" ON "object_definitions" USING btree ("tenant_id","external_reference_code");--> statement-breakpoint
CREATE UNIQUE INDEX "object_definitions_tenant_name_uq" ON "object_definitions" USING btree ("tenant_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "object_records_tenant_erc_uq" ON "object_records" USING btree ("tenant_id","external_reference_code");--> statement-breakpoint
CREATE INDEX "object_records_tenant_definition_idx" ON "object_records" USING btree ("tenant_id","object_definition_id");