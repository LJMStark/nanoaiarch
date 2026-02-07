CREATE INDEX "generation_history_public_gallery_idx" ON "generation_history" USING btree ("is_public","status","created_at");--> statement-breakpoint
CREATE INDEX "project_message_project_order_idx" ON "project_message" USING btree ("project_id","order_index");--> statement-breakpoint
CREATE INDEX "project_message_user_project_idx" ON "project_message" USING btree ("user_id","project_id");