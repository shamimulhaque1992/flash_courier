-- AlterTable customers: nullable so no issue, cast with UPPER
ALTER TABLE "customers"
  ALTER COLUMN "division" TYPE "Division" USING UPPER("division")::"Division";

-- AlterTable riders: required column, cast with UPPER
ALTER TABLE "riders"
  ALTER COLUMN "division" TYPE "Division" USING UPPER("division")::"Division";
