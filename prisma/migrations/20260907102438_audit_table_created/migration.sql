/*
  Warnings:

  - Made the column `division` on table `customers` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "customers" ALTER COLUMN "division" SET NOT NULL;

-- CreateTable
CREATE TABLE "merchant_audits" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "reportUrl" TEXT NOT NULL,
    "reportPublicId" TEXT NOT NULL,
    "publishedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "merchant_audits_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "merchant_audits" ADD CONSTRAINT "merchant_audits_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "merchants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
