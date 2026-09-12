-- The gate between the open form at `/vouch` and the homepage.
--
-- Nullable, like `Post.publishedAt`, and for the same reason: null is not a
-- missing value, it is the answer "this is not on the page".

-- AlterTable
ALTER TABLE "Testimonial" ADD COLUMN     "publishedAt" TIMESTAMP(3);

-- Backfill: every row collected BEFORE this column existed is published.
--
-- Deliberate, and the opposite of what a default would do. These rows were
-- gathered one at a time, annotated by hand with a face, a role and a profile,
-- and read before this migration was written — the review the column exists to
-- enforce has already happened for them. Leaving them null would have taken a
-- finished wall off the homepage on the day it shipped.
--
-- `CURRENT_TIMESTAMP` rather than `"createdAt"`, because that is what this
-- column means: when the row was PUBLISHED, which is now. Nothing orders by it
-- — the homepage reads newest-first by `createdAt`, as the admin board does —
-- so eight rows sharing a publication instant costs nothing.
UPDATE "Testimonial" SET "publishedAt" = CURRENT_TIMESTAMP;
