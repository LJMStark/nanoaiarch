CREATE TABLE "newsletter_job" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"email" text NOT NULL,
	"type" text DEFAULT 'subscribe' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"idempotency_key" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"next_attempt_at" timestamp DEFAULT now() NOT NULL,
	"lease_expires_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "newsletter_job_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "request_rate_limit" (
	"key" text PRIMARY KEY NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"reset_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "image_project" ALTER COLUMN "model" SET DEFAULT 'flash';--> statement-breakpoint
UPDATE "image_project"
SET "model" = 'flash'
WHERE "model" = 'gemini-2.0-flash-exp';--> statement-breakpoint
ALTER TABLE "newsletter_job" ADD CONSTRAINT "newsletter_job_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "newsletter_job_status_next_attempt_idx" ON "newsletter_job" USING btree ("status","next_attempt_at");--> statement-breakpoint
CREATE INDEX "newsletter_job_user_id_idx" ON "newsletter_job" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "request_rate_limit_reset_at_idx" ON "request_rate_limit" USING btree ("reset_at");
