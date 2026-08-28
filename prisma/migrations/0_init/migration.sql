-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "PostCategory" AS ENUM ('ARTICLE', 'WORK', 'PAGE');

-- CreateTable
CREATE TABLE "Post" (
    "id" TEXT NOT NULL,
    "title" TEXT,
    "slug" TEXT NOT NULL,
    "category" "PostCategory" NOT NULL DEFAULT 'ARTICLE',
    "content" JSONB NOT NULL,
    "coverImageKey" TEXT,
    "aspect" TEXT,
    "publishedAt" TIMESTAMP(3),
    "untitledIndex" INTEGER,
    "gridIndex" INTEGER,
    "gridSpan" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Post_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Component" (
    "id" TEXT NOT NULL,
    "componentId" TEXT NOT NULL,
    "aspect" TEXT,
    "logger" BOOLEAN,
    "gridIndex" INTEGER,
    "gridSpan" INTEGER,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Component_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cover" (
    "id" TEXT NOT NULL,
    "title" TEXT,
    "untitledIndex" INTEGER,
    "shaderId" TEXT NOT NULL,
    "settings" JSONB NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cover_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserProfile" (
    "id" TEXT NOT NULL,
    "neonUserId" TEXT NOT NULL,
    "githubLogin" TEXT,
    "email" TEXT,
    "displayName" TEXT,
    "avatarUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Post_slug_key" ON "Post"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "UserProfile_neonUserId_key" ON "UserProfile"("neonUserId");

-- CreateIndex
CREATE UNIQUE INDEX "UserProfile_githubLogin_key" ON "UserProfile"("githubLogin");

-- CreateIndex
CREATE UNIQUE INDEX "UserProfile_email_key" ON "UserProfile"("email");

