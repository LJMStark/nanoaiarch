CREATE TABLE "referral" (
	"id" text PRIMARY KEY NOT NULL,
	"referrer_id" text NOT NULL,
	"referred_id" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"qualified_at" timestamp,
	"rewarded_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "referral_referred_id_unique" UNIQUE("referred_id")
);
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "referral_code" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "referred_by" text;--> statement-breakpoint
ALTER TABLE "referral" ADD CONSTRAINT "referral_referrer_id_user_id_fk" FOREIGN KEY ("referrer_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral" ADD CONSTRAINT "referral_referred_id_user_id_fk" FOREIGN KEY ("referred_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "referral_referrer_id_idx" ON "referral" USING btree ("referrer_id");--> statement-breakpoint
CREATE INDEX "referral_status_idx" ON "referral" USING btree ("status");--> statement-breakpoint
CREATE INDEX "user_referral_code_idx" ON "user" USING btree ("referral_code");--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_referral_code_unique" UNIQUE("referral_code");