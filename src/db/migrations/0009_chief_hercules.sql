CREATE TABLE "image_project" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"title" text DEFAULT 'Untitled' NOT NULL,
	"cover_image" text,
	"template_id" text,
	"style_preset" text,
	"aspect_ratio" text DEFAULT '1:1',
	"model" text DEFAULT 'gemini-2.0-flash-exp',
	"message_count" integer DEFAULT 0 NOT NULL,
	"generation_count" integer DEFAULT 0 NOT NULL,
	"total_credits_used" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"is_pinned" boolean DEFAULT false NOT NULL,
	"last_active_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_message" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"input_image" text,
	"output_image" text,
	"mask_image" text,
	"generation_params" text,
	"credits_used" integer DEFAULT 0,
	"generation_time" integer,
	"status" text DEFAULT 'completed' NOT NULL,
	"error_message" text,
	"order_index" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "image_project" ADD CONSTRAINT "image_project_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_message" ADD CONSTRAINT "project_message_project_id_image_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."image_project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_message" ADD CONSTRAINT "project_message_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "image_project_user_id_idx" ON "image_project" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "image_project_status_idx" ON "image_project" USING btree ("status");--> statement-breakpoint
CREATE INDEX "image_project_last_active_at_idx" ON "image_project" USING btree ("last_active_at");--> statement-breakpoint
CREATE INDEX "image_project_is_pinned_idx" ON "image_project" USING btree ("is_pinned");--> statement-breakpoint
CREATE INDEX "project_message_project_id_idx" ON "project_message" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "project_message_user_id_idx" ON "project_message" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "project_message_status_idx" ON "project_message" USING btree ("status");--> statement-breakpoint
CREATE INDEX "project_message_order_idx" ON "project_message" USING btree ("order_index");