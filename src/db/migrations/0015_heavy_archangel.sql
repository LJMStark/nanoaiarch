ALTER TABLE "credit_transaction" ADD COLUMN "hold_status" text;--> statement-breakpoint
ALTER TABLE "credit_transaction" ADD COLUMN "idempotency_key" text;--> statement-breakpoint
CREATE INDEX "credit_transaction_hold_status_idx" ON "credit_transaction" USING btree ("hold_status");--> statement-breakpoint
CREATE INDEX "credit_transaction_idempotency_key_idx" ON "credit_transaction" USING btree ("idempotency_key");--> statement-breakpoint
ALTER TABLE "credit_transaction" ADD CONSTRAINT "credit_transaction_idempotency_key_unique" UNIQUE("idempotency_key");