CREATE TABLE "generation_history" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"template_id" text,
	"template_name" text,
	"prompt" text NOT NULL,
	"enhanced_prompt" text,
	"style" text,
	"aspect_ratio" text,
	"model" text,
	"image_url" text,
	"reference_image_url" text,
	"credits_used" integer DEFAULT 1 NOT NULL,
	"status" text DEFAULT 'completed' NOT NULL,
	"error_message" text,
	"is_favorite" boolean DEFAULT false NOT NULL,
	"is_public" boolean DEFAULT false NOT NULL,
	"metadata" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "generation_history" ADD CONSTRAINT "generation_history_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "generation_history_user_id_idx" ON "generation_history" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "generation_history_template_id_idx" ON "generation_history" USING btree ("template_id");--> statement-breakpoint
CREATE INDEX "generation_history_status_idx" ON "generation_history" USING btree ("status");--> statement-breakpoint
CREATE INDEX "generation_history_is_favorite_idx" ON "generation_history" USING btree ("is_favorite");--> statement-breakpoint
CREATE INDEX "generation_history_is_public_idx" ON "generation_history" USING btree ("is_public");--> statement-breakpoint
CREATE INDEX "generation_history_created_at_idx" ON "generation_history" USING btree ("created_at");