-- CreateEnum
CREATE TYPE "Department" AS ENUM ('IT', 'FINANCE', 'OPERATIONS', 'HR', 'MARKETING', 'SALES', 'LEGAL', 'MANAGEMENT', 'SUPPORT', 'PROCUREMENT');

-- CreateEnum
CREATE TYPE "BillingCycle" AS ENUM ('MONTHLY', 'QUARTERLY', 'SEMESTER', 'YEARLY', 'ONE_TIME', 'CUSTOM');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'EXPIRING_SOON', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SubscriptionKind" AS ENUM ('SUBSCRIPTION', 'MEMBERSHIP', 'CARD', 'CONTRACT', 'LEASE', 'LICENSE', 'INSURANCE', 'DOMAIN', 'PERMIT', 'OTHER');

-- CreateEnum
CREATE TYPE "NotifChannel" AS ENUM ('EMAIL', 'TELEGRAM');

-- CreateEnum
CREATE TYPE "PaymentMethodType" AS ENUM ('CARD', 'BANK_TRANSFER', 'INVOICE', 'WIRE', 'CHECK', 'PAYPAL', 'CASH', 'OTHER');

-- CreateEnum
CREATE TYPE "NotifType" AS ENUM ('RENEWAL_REMINDER_90_DAYS', 'RENEWAL_REMINDER_30_DAYS', 'RENEWAL_REMINDER_14_DAYS', 'RENEWAL_REMINDER_7_DAYS', 'RENEWAL_REMINDER_3_DAYS', 'RENEWAL_REMINDER_1_DAY', 'RENEWAL_SUCCESS', 'RENEWAL_FAILED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VendorCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT 'gray',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VendorCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vendor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "categoryId" TEXT,
    "website" TEXT,
    "contactEmail" TEXT,
    "contactName" TEXT,
    "contactPhone" TEXT,
    "notes" TEXT,
    "paymentMethod" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vendor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "planName" TEXT NOT NULL,
    "kind" "SubscriptionKind" NOT NULL DEFAULT 'SUBSCRIPTION',
    "department" "Department",
    "cost" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "billingCycle" "BillingCycle" NOT NULL DEFAULT 'MONTHLY',
    "customDays" INTEGER,
    "startDate" TIMESTAMP(3) NOT NULL,
    "renewalDate" TIMESTAMP(3) NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "autoRenew" BOOLEAN NOT NULL DEFAULT false,
    "cardBrand" TEXT,
    "cardLast4" TEXT,
    "responsibleId" TEXT,
    "paymentMethodId" TEXT,
    "notes" TEXT,
    "documentPath" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentMethod" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "PaymentMethodType" NOT NULL,
    "cardBrand" TEXT,
    "cardLast4" TEXT,
    "cardExpiry" TEXT,
    "bankName" TEXT,
    "accountLast4" TEXT,
    "reference" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentMethod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RenewalLog" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "previousDate" TIMESTAMP(3) NOT NULL,
    "newDate" TIMESTAMP(3) NOT NULL,
    "renewedById" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RenewalLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "paidAt" TIMESTAMP(3) NOT NULL,
    "paidById" TEXT,
    "note" TEXT,
    "receiptUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationConfig" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "daysBefore" INTEGER NOT NULL,
    "channel" "NotifChannel" NOT NULL DEFAULT 'EMAIL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationLog" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "type" "NotifType" NOT NULL,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "recipients" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GlobalNotificationSetting" (
    "id" TEXT NOT NULL DEFAULT 'global',
    "renewal7d" BOOLEAN NOT NULL DEFAULT true,
    "renewal3d" BOOLEAN NOT NULL DEFAULT true,
    "renewal1d" BOOLEAN NOT NULL DEFAULT true,
    "renewalExpired" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "GlobalNotificationSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_NotifyUsers" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "VendorCategory_name_key" ON "VendorCategory"("name");

-- CreateIndex
CREATE UNIQUE INDEX "VendorCategory_slug_key" ON "VendorCategory"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Vendor_name_key" ON "Vendor"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Vendor_slug_key" ON "Vendor"("slug");

-- CreateIndex
CREATE INDEX "Subscription_renewalDate_idx" ON "Subscription"("renewalDate");

-- CreateIndex
CREATE INDEX "Subscription_status_idx" ON "Subscription"("status");

-- CreateIndex
CREATE INDEX "Subscription_responsibleId_idx" ON "Subscription"("responsibleId");

-- CreateIndex
CREATE INDEX "Subscription_vendorId_idx" ON "Subscription"("vendorId");

-- CreateIndex
CREATE INDEX "Subscription_paymentMethodId_idx" ON "Subscription"("paymentMethodId");

-- CreateIndex
CREATE INDEX "PaymentMethod_isActive_idx" ON "PaymentMethod"("isActive");

-- CreateIndex
CREATE INDEX "RenewalLog_subscriptionId_idx" ON "RenewalLog"("subscriptionId");

-- CreateIndex
CREATE INDEX "RenewalLog_renewedById_idx" ON "RenewalLog"("renewedById");

-- CreateIndex
CREATE INDEX "Payment_subscriptionId_idx" ON "Payment"("subscriptionId");

-- CreateIndex
CREATE INDEX "Payment_paidById_idx" ON "Payment"("paidById");

-- CreateIndex
CREATE INDEX "NotificationLog_subscriptionId_idx" ON "NotificationLog"("subscriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationLog_subscriptionId_type_scheduledFor_key" ON "NotificationLog"("subscriptionId", "type", "scheduledFor");

-- CreateIndex
CREATE UNIQUE INDEX "_NotifyUsers_AB_unique" ON "_NotifyUsers"("A", "B");

-- CreateIndex
CREATE INDEX "_NotifyUsers_B_index" ON "_NotifyUsers"("B");

-- AddForeignKey
ALTER TABLE "Vendor" ADD CONSTRAINT "Vendor_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "VendorCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_responsibleId_fkey" FOREIGN KEY ("responsibleId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_paymentMethodId_fkey" FOREIGN KEY ("paymentMethodId") REFERENCES "PaymentMethod"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RenewalLog" ADD CONSTRAINT "RenewalLog_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RenewalLog" ADD CONSTRAINT "RenewalLog_renewedById_fkey" FOREIGN KEY ("renewedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_paidById_fkey" FOREIGN KEY ("paidById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationConfig" ADD CONSTRAINT "NotificationConfig_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationLog" ADD CONSTRAINT "NotificationLog_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_NotifyUsers" ADD CONSTRAINT "_NotifyUsers_A_fkey" FOREIGN KEY ("A") REFERENCES "NotificationConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_NotifyUsers" ADD CONSTRAINT "_NotifyUsers_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
