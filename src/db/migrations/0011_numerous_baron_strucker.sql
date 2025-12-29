ALTER TABLE "user" ADD COLUMN "bio" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "is_profile_public" boolean DEFAULT true NOT NULL;