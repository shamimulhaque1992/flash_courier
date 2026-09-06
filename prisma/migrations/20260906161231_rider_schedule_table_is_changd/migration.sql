/*
  Warnings:

  - You are about to drop the column `isBooked` on the `rider_schedules` table. All the data in the column will be lost.
  - You are about to drop the column `slotEnd` on the `rider_schedules` table. All the data in the column will be lost.
  - You are about to drop the column `slotStart` on the `rider_schedules` table. All the data in the column will be lost.
  - You are about to drop the column `scheduleSlotId` on the `shipments` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[riderId,dayOfWeek]` on the table `rider_schedules` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `availableSlots` to the `rider_schedules` table without a default value. This is not possible if the table is not empty.
  - Added the required column `dayOfWeek` to the `rider_schedules` table without a default value. This is not possible if the table is not empty.
  - Added the required column `endTime` to the `rider_schedules` table without a default value. This is not possible if the table is not empty.
  - Added the required column `startTime` to the `rider_schedules` table without a default value. This is not possible if the table is not empty.
  - Added the required column `totalSlots` to the `rider_schedules` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "DayOfWeek" AS ENUM ('SATURDAY', 'SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY');

-- DropForeignKey
ALTER TABLE "shipments" DROP CONSTRAINT "shipments_scheduleSlotId_fkey";

-- DropIndex
DROP INDEX "rider_schedules_riderId_slotStart_key";

-- DropIndex
DROP INDEX "shipments_scheduleSlotId_key";

-- AlterTable
ALTER TABLE "rider_schedules" DROP COLUMN "isBooked",
DROP COLUMN "slotEnd",
DROP COLUMN "slotStart",
ADD COLUMN     "availableSlots" INTEGER NOT NULL,
ADD COLUMN     "dayOfWeek" "DayOfWeek" NOT NULL,
ADD COLUMN     "endTime" TEXT NOT NULL,
ADD COLUMN     "startTime" TEXT NOT NULL,
ADD COLUMN     "totalSlots" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "shipments" DROP COLUMN "scheduleSlotId",
ADD COLUMN     "scheduleId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "rider_schedules_riderId_dayOfWeek_key" ON "rider_schedules"("riderId", "dayOfWeek");

-- AddForeignKey
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "rider_schedules"("id") ON DELETE SET NULL ON UPDATE CASCADE;
