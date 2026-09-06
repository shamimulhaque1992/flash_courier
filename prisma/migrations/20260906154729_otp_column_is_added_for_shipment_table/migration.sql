/*
  Warnings:

  - A unique constraint covering the columns `[otp]` on the table `shipments` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "shipments" ADD COLUMN     "otp" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "shipments_otp_key" ON "shipments"("otp");
