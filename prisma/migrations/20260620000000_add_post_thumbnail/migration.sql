-- Add thumbnailUrl to Post table
ALTER TABLE "Post" ADD COLUMN IF NOT EXISTS "thumbnailUrl" TEXT;
