CREATE INDEX "blocks_tenant_folder_id_idx" ON "blocks" USING btree ("tenant_id","folder_id","id");--> statement-breakpoint
CREATE INDEX "object_definitions_tenant_folder_id_idx" ON "object_definitions" USING btree ("tenant_id","folder_id","id");--> statement-breakpoint
CREATE INDEX "content_types_tenant_folder_id_idx" ON "content_types" USING btree ("tenant_id","folder_id","id");--> statement-breakpoint
CREATE INDEX "content_entries_tenant_folder_id_idx" ON "content_entries" USING btree ("tenant_id","folder_id","id");