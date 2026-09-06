/*
  Warnings:

  - You are about to drop the column `availableSlots` on the `rider_schedules` table. All the data in the column will be lost.
  - You are about to drop the column `endDateTime` on the `rider_schedules` table. All the data in the column will be lost.
  - You are about to drop the column `startDateTime` on the `rider_schedules` table. All the data in the column will be lost.
  - You are about to drop the column `totalSlots` on the `rider_schedules` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[riderId,slotStart]` on the table `rider_schedules` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[scheduleSlotId]` on the table `shipments` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `slotEnd` to the `rider_schedules` table without a default value. This is not possible if the table is not empty.
  - Added the required column `slotStart` to the `rider_schedules` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "rider_schedules_riderId_startDateTime_endDateTime_key";

-- AlterTable
ALTER TABLE "rider_schedules" DROP COLUMN "availableSlots",
DROP COLUMN "endDateTime",
DROP COLUMN "startDateTime",
DROP COLUMN "totalSlots",
ADD COLUMN     "isBooked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "slotEnd" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "slotStart" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "shipments" ADD COLUMN     "scheduleSlotId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "rider_schedules_riderId_slotStart_key" ON "rider_schedules"("riderId", "slotStart");

-- CreateIndex
CREATE UNIQUE INDEX "shipments_scheduleSlotId_key" ON "shipments"("scheduleSlotId");

-- AddForeignKey
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_scheduleSlotId_fkey" FOREIGN KEY ("scheduleSlotId") REFERENCES "rider_schedules"("id") ON DELETE SET NULL ON UPDATE CASCADE;
