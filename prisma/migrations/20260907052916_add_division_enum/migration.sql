-- CreateEnum
CREATE TYPE "Division" AS ENUM ('DHAKA', 'CHATTOGRAM', 'RAJSHAHI', 'KHULNA', 'BARISHAL', 'SYLHET', 'RANGPUR', 'MYMENSINGH');

-- AlterTable merchants: uppercase existing values then cast to enum
ALTER TABLE "merchants"
  ALTER COLUMN "division" TYPE "Division" USING UPPER("division")::"Division";

-- AlterTable shipments: uppercase existing values then cast to enum
ALTER TABLE "shipments"
  ALTER COLUMN "receiverDivision" TYPE "Division" USING UPPER("receiverDivision")::"Division";
