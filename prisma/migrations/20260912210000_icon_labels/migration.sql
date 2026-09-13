-- What the bucket cannot say about an icon: the name it is called by, and the
-- words it can be found under. See the `Icon` model for why this is a table
-- rather than object metadata (metadata cannot be listed by, and the icons
-- listing searches these words), and why nothing is backfilled here: an icon
-- with no row is called what its filename says, which is every icon there is
-- until somebody types something better.

-- CreateTable
CREATE TABLE "Icon" (
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "aliases" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Icon_pkey" PRIMARY KEY ("key")
);
