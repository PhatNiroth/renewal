/*
  Warnings:

  - You are about to drop the column `paymentMethodId` on the `Subscription` table. All the data in the column will be lost.
  - You are about to drop the `Payment` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `PaymentMethod` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Payment" DROP CONSTRAINT "Payment_paidById_fkey";

-- DropForeignKey
ALTER TABLE "Payment" DROP CONSTRAINT "Payment_subscriptionId_fkey";

-- DropForeignKey
ALTER TABLE "Subscription" DROP CONSTRAINT "Subscription_paymentMethodId_fkey";

-- DropIndex
DROP INDEX "Subscription_paymentMethodId_idx";

-- AlterTable
ALTER TABLE "Subscription" DROP COLUMN "paymentMethodId";

-- DropTable
DROP TABLE "Payment";

-- DropTable
DROP TABLE "PaymentMethod";

-- DropEnum
DROP TYPE "PaymentMethodType";
