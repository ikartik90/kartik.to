-- What the metadata sidebar edits beyond the category, which already had a
-- column: a written search description, and the addresses a post has been read
-- at before its current one. See the `Post` model for both.

-- AlterTable
ALTER TABLE "Post" ADD COLUMN     "description" TEXT,
ADD COLUMN     "previousSlugs" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- The one rename made before the app could make its own. It was kept in
-- `src/data/moved-posts.ts`, which this column replaces, so it moves here
-- rather than being lost: `/work/scheduling-extensions` keeps redirecting.
UPDATE "Post"
SET "previousSlugs" = ARRAY['scheduling-extensions']
WHERE "slug" = 'redesigning-shift-scheduling';
