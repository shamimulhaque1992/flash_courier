/*
  Warnings:

  - You are about to drop the column `ridersDistrict` on the `riders` table. All the data in the column will be lost.
  - You are about to drop the column `ridersDivision` on the `riders` table. All the data in the column will be lost.
  - You are about to drop the column `ridersThana` on the `riders` table. All the data in the column will be lost.
  - Added the required column `district` to the `riders` table without a default value. This is not possible if the table is not empty.
  - Added the required column `division` to the `riders` table without a default value. This is not possible if the table is not empty.
  - Added the required column `thana` to the `riders` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "riders" DROP COLUMN "ridersDistrict",
DROP COLUMN "ridersDivision",
DROP COLUMN "ridersThana",
ADD COLUMN     "district" TEXT NOT NULL,
ADD COLUMN     "division" TEXT NOT NULL,
ADD COLUMN     "thana" TEXT NOT NULL;
