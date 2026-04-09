import { PrismaClient, BillingCycle, SubscriptionStatus, Module } from "@prisma/client"
import bcrypt from "bcryptjs"

const db = new PrismaClient()

async function main() {
  console.log("Seeding database...")

  const allModules = [Module.SUBSCRIPTIONS, Module.RENEWALS, Module.VENDORS, Module.PAYMENTS]

  const opsRole = await db.role.upsert({
    where: { name: "Operations" },
    create: {
      name: "Operations",
      isSystem: true,
      permissions: {
        create: [
          { module: Module.SUBSCRIPTIONS, canView: true, canAdd: true,  canEdit: true,  canDelete: true  },
          { module: Module.RENEWALS,       canView: true, canAdd: true,  canEdit: true,  canDelete: false },
          { module: Module.VENDORS,        canView: true, canAdd: true,  canEdit: true,  canDelete: false },
          { module: Module.PAYMENTS,       canView: true, canAdd: false, canEdit: false, canDelete: false },
        ],
      },
    },
    update: {},
  })
  console.log("  ✓ Role: Operations")

  const accRole = await db.role.upsert({
    where: { name: "Accounting" },
    create: {
      name: "Accounting",
      isSystem: true,
      permissions: {
        create: [
          { module: Module.SUBSCRIPTIONS, canView: true, canAdd: true,  canEdit: true,  canDelete: false },
          { module: Module.RENEWALS,       canView: true, canAdd: false, canEdit: false, canDelete: false },
          { module: Module.VENDORS,        canView: true, canAdd: false, canEdit: false, canDelete: false },
          { module: Module.PAYMENTS,       canView: true, canAdd: true,  canEdit: true,  canDelete: true  },
        ],
      },
    },
    update: {},
  })
  console.log("  ✓ Role: Accounting")

  await db.role.upsert({
    where: { name: "Viewer" },
    create: {
      name: "Viewer",
      isSystem: true,
      permissions: {
        create: allModules.map(module => ({
          module,
          canView: true,
          canAdd: false,
          canEdit: false,
          canDelete: false,
        })),
      },
    },
    update: {},
  })
  console.log("  ✓ Role: Viewer")

  const adminPassword = await bcrypt.hash("admin123", 10)
  const admin = await db.user.upsert({
    where: { email: "admin@company.com" },
    create: { email: "admin@company.com", name: "System Admin", password: adminPassword, isAdmin: true },
    update: {},
  })
  console.log("  ✓ Admin user (admin@company.com / admin123)")

  const opsPassword = await bcrypt.hash("ops123", 10)
  const ops = await db.user.upsert({
    where: { email: "ops@company.com" },
    create: { email: "ops@company.com", name: "Operations Team", password: opsPassword, roleId: opsRole.id },
    update: {},
  })
  console.log("  ✓ Operations user (ops@company.com / ops123)")

  const accPassword = await bcrypt.hash("acc123", 10)
  const acc = await db.user.upsert({
    where: { email: "accounting@company.com" },
    create: { email: "accounting@company.com", name: "Accounting Team", password: accPassword, roleId: accRole.id },
    update: {},
  })
  console.log("  ✓ Accounting user (accounting@company.com / acc123)")

  const categoryData = [
    { name: "SaaS",       slug: "saas",       color: "blue"    },
    { name: "Contract",   slug: "contract",   color: "violet"  },
    { name: "Government", slug: "government", color: "amber"   },
    { name: "Utility",    slug: "utility",    color: "emerald" },
    { name: "Other",      slug: "other",      color: "gray"    },
  ]

  const catMap: Record<string, string> = {}
  for (const cat of categoryData) {
    const c = await db.vendorCategory.upsert({ where: { slug: cat.slug }, create: cat, update: {} })
    catMap[cat.slug] = c.id
    console.log("  ✓ Category: " + cat.name)
  }

  const vendors = [
    { name: "Anthropic",           slug: "anthropic",        categoryId: catMap["saas"],       website: "https://anthropic.com",        contactEmail: "support@anthropic.com"    },
    { name: "DigitalOcean",        slug: "digitalocean",     categoryId: catMap["saas"],       website: "https://digitalocean.com",     contactEmail: "support@digitalocean.com" },
    { name: "GitHub",              slug: "github",           categoryId: catMap["saas"],       website: "https://github.com",           contactEmail: "support@github.com"       },
    { name: "Google Workspace",    slug: "google-workspace", categoryId: catMap["saas"],       website: "https://workspace.google.com"                                           },
    { name: "Ministry of Finance", slug: "ministry-finance", categoryId: catMap["government"], contactEmail: "info@mof.gov"                                                      },
  ]

  const createdVendors: Record<string, string> = {}
  for (const v of vendors) {
    const vendor = await db.vendor.upsert({ where: { slug: v.slug }, create: v, update: {} })
    createdVendors[v.slug] = vendor.id
    console.log("  ✓ Vendor: " + v.name)
  }

  const now       = new Date()
  const nextMonth = new Date(now); nextMonth.setMonth(now.getMonth() + 1)
  const nextYear  = new Date(now); nextYear.setFullYear(now.getFullYear() + 1)
  const in7Days   = new Date(now); in7Days.setDate(now.getDate() + 7)
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1)

  const subscriptions = [
    { vendorId: createdVendors["anthropic"],        planName: "Claude API — Team",           cost:   50000, billingCycle: BillingCycle.MONTHLY, startDate: new Date("2025-01-01"), renewalDate: nextMonth, status: SubscriptionStatus.ACTIVE,        responsibleId: ops.id,   notes: "Used for AI features across all internal tools" },
    { vendorId: createdVendors["digitalocean"],     planName: "Business Plan",               cost:   15000, billingCycle: BillingCycle.MONTHLY, startDate: new Date("2024-06-01"), renewalDate: in7Days,   status: SubscriptionStatus.EXPIRING_SOON, responsibleId: ops.id,   notes: "Hosting for production servers"                 },
    { vendorId: createdVendors["github"],           planName: "GitHub Enterprise",           cost: 2100000, billingCycle: BillingCycle.YEARLY,  startDate: new Date("2025-03-01"), renewalDate: nextYear,  status: SubscriptionStatus.ACTIVE,        responsibleId: admin.id                                                                          },
    { vendorId: createdVendors["google-workspace"], planName: "Business Starter (50 seats)", cost:  300000, billingCycle: BillingCycle.MONTHLY, startDate: new Date("2023-09-01"), renewalDate: nextMonth, status: SubscriptionStatus.ACTIVE,        responsibleId: acc.id,   notes: "Email and collaboration for all staff"          },
    { vendorId: createdVendors["ministry-finance"], planName: "Annual Government License",   cost:  500000, billingCycle: BillingCycle.YEARLY,  startDate: new Date("2025-01-01"), renewalDate: yesterday, status: SubscriptionStatus.EXPIRED,       responsibleId: ops.id,   notes: "License for compliance reporting portal"        },
  ]

  for (const sub of subscriptions) {
    await db.subscription.create({ data: sub })
    console.log("  ✓ Subscription: " + sub.planName)
  }

  console.log("\nSeed complete.")
  console.log("\nDefault accounts:")
  console.log("  Admin:      admin@company.com / admin123")
  console.log("  Operations: ops@company.com / ops123")
  console.log("  Accounting: accounting@company.com / acc123")
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => db.$disconnect())
