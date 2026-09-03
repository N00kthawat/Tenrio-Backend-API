-- CreateTable
CREATE TABLE "Microsoft365Plan" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "featureKeys" TEXT[],
    "isActive" BOOLEAN NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "providerProductId" TEXT,
    "providerSkuId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Microsoft365Plan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Microsoft365Plan_code_key" ON "Microsoft365Plan"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Microsoft365Plan_slug_key" ON "Microsoft365Plan"("slug");
