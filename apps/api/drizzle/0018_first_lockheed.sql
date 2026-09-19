ALTER TABLE "blocks" ADD COLUMN "native_html" text;--> statement-breakpoint
ALTER TABLE "blocks" ADD COLUMN "native_css" text;--> statement-breakpoint
ALTER TABLE "blocks" ADD COLUMN "template_source" varchar(16) DEFAULT 'CUSTOM' NOT NULL;