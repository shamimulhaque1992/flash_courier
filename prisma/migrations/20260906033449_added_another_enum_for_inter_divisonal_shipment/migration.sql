-- AlterEnum
ALTER TYPE "ShipmentStatus" ADD VALUE 'IN_TRANSIT';

-- AlterTable
ALTER TABLE "shipments" ADD COLUMN     "isFragile" BOOLEAN NOT NULL DEFAULT false;
