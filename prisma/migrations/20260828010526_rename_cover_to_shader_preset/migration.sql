-- Rename the `Cover` model to `ShaderPreset`.
--
-- A RENAME, not a drop-and-create, and that distinction is the whole migration:
-- the rows are saved shader presets an author tuned by hand, and Prisma cannot
-- infer a rename from a schema diff — left to `db push` it would resolve the
-- difference by dropping `Cover` and creating an empty `ShaderPreset`.
--
-- Postgres carries the data, the column types and the defaults across a table
-- rename, but NOT the names of the constraints hanging off it: the primary key
-- would still be called `Cover_pkey`, which is drift Prisma reports on the next
-- migration. Renaming it here is what keeps the database matching the schema.
ALTER TABLE "Cover" RENAME TO "ShaderPreset";
ALTER TABLE "ShaderPreset" RENAME CONSTRAINT "Cover_pkey" TO "ShaderPreset_pkey";
