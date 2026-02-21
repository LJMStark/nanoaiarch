DROP INDEX "generation_history_is_favorite_idx";--> statement-breakpoint
DROP INDEX "generation_history_is_public_idx";--> statement-breakpoint
DROP INDEX "payment_paid_idx";--> statement-breakpoint
DROP INDEX "user_id_idx";--> statement-breakpoint
CREATE INDEX "credit_transaction_user_created_at_idx" ON "credit_transaction" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "project_message_project_created_at_idx" ON "project_message" USING btree ("project_id","created_at");