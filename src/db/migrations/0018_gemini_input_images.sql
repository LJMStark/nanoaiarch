ALTER TABLE "project_message" ADD COLUMN "input_images" text;
--> statement-breakpoint
UPDATE "project_message"
SET "input_images" = json_build_array("input_image")::text
WHERE "input_image" IS NOT NULL
  AND "input_images" IS NULL;
