import { PrismaClient, BillingCycle, SubscriptionKind, SubscriptionStatus } from "@prisma/client"

const db = new PrismaClient()

async function main() {
  console.log("Seeding database...")

  // Clear data (order matters for FK constraints)
  await db.notificationConfig.deleteMany()
  await db.subscription.deleteMany()
  await db.vendor.deleteMany()

  // Seed placeholder users — auth is handled by dashboard.krawma.com.
  // These exist only so subscriptions can have a responsibleId.
  const admin = await db.user.upsert({
    where:  { email: "admin@krawma.com" },
    create: { email: "admin@krawma.com", name: "System Admin", isAdmin: true },
    update: {},
  })
  const ops = await db.user.upsert({
    where:  { email: "ops@krawma.com" },
    create: { email: "ops@krawma.com", name: "Operations Team" },
    update: {},
  })
  const acc = await db.user.upsert({
    where:  { email: "acc@krawma.com" },
    create: { email: "acc@krawma.com", name: "Accounting Team" },
    update: {},
  })
  console.log("  ✓ Placeholder users (no passwords — login via dashboard.krawma.com)")

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
    { name: "Notion",              slug: "notion",           categoryId: catMap["saas"],       website: "https://notion.so",            contactEmail: "support@notion.so"        },
    { name: "Ministry of Finance", slug: "ministry-finance", categoryId: catMap["government"], contactEmail: "info@mof.gov"                                                      },
    { name: "City Hall Permits",   slug: "city-hall",        categoryId: catMap["government"], contactEmail: "permits@cityhall.gov"                                              },
    { name: "CleanPro Services",   slug: "cleanpro",         categoryId: catMap["contract"],   contactEmail: "contracts@cleanpro.com"                                            },
    { name: "SecureNet IT",        slug: "securenet",        categoryId: catMap["contract"],   contactEmail: "support@securenet.com"                                             },
    { name: "GoDaddy",             slug: "godaddy",          categoryId: catMap["other"],      website: "https://godaddy.com",          contactEmail: "support@godaddy.com"      },
    { name: "AXA Insurance",       slug: "axa",              categoryId: catMap["other"],      website: "https://axa.com",              contactEmail: "business@axa.com"         },
    { name: "Citibank",            slug: "citibank",         categoryId: catMap["other"],      website: "https://citibank.com",         contactEmail: "corporate@citibank.com"   },
    { name: "WeWork",              slug: "wework",           categoryId: catMap["other"],      website: "https://wework.com",           contactEmail: "accounts@wework.com"      },
  ]

  const createdVendors: Record<string, string> = {}
  for (const v of vendors) {
    const vendor = await db.vendor.upsert({ where: { slug: v.slug }, create: v, update: { name: v.name } })
    createdVendors[v.slug] = vendor.id
    console.log("  ✓ Vendor: " + v.name)
  }

  const now        = new Date()
  const nextMonth  = new Date(now); nextMonth.setMonth(now.getMonth() + 1)
  const nextYear   = new Date(now); nextYear.setFullYear(now.getFullYear() + 1)
  const in7Days    = new Date(now); in7Days.setDate(now.getDate() + 7)
  const in14Days   = new Date(now); in14Days.setDate(now.getDate() + 14)
  const in3Months  = new Date(now); in3Months.setMonth(now.getMonth() + 3)
  const in6Months  = new Date(now); in6Months.setMonth(now.getMonth() + 6)
  const in2Years   = new Date(now); in2Years.setFullYear(now.getFullYear() + 2)
  const yesterday  = new Date(now); yesterday.setDate(now.getDate() - 1)
  const cardExpiry = new Date("2027-08-31")

  const subscriptions: Array<{
    vendorId: string
    planName: string
    kind: SubscriptionKind
    cost: number
    billingCycle: BillingCycle
    startDate: Date
    renewalDate: Date
    status: SubscriptionStatus
    responsibleId: string
    notes?: string
    autoRenew?: boolean
    cardBrand?: string
    cardLast4?: string
  }> = [
    { vendorId: createdVendors["anthropic"],        kind: SubscriptionKind.SUBSCRIPTION, planName: "Claude API — Team",            cost:   50000, billingCycle: BillingCycle.MONTHLY, startDate: new Date("2025-01-01"), renewalDate: nextMonth,  status: SubscriptionStatus.ACTIVE,        responsibleId: ops.id,   notes: "Used for AI features across all internal tools", autoRenew: true  },
    { vendorId: createdVendors["digitalocean"],     kind: SubscriptionKind.SUBSCRIPTION, planName: "Business Plan",                cost:   15000, billingCycle: BillingCycle.MONTHLY, startDate: new Date("2024-06-01"), renewalDate: in7Days,    status: SubscriptionStatus.EXPIRING_SOON, responsibleId: ops.id,   notes: "Hosting for production servers"                                   },
    { vendorId: createdVendors["github"],           kind: SubscriptionKind.SUBSCRIPTION, planName: "GitHub Enterprise",           cost: 2100000, billingCycle: BillingCycle.YEARLY,  startDate: new Date("2025-03-01"), renewalDate: nextYear,   status: SubscriptionStatus.ACTIVE,        responsibleId: admin.id, autoRenew: true                                                           },
    { vendorId: createdVendors["google-workspace"], kind: SubscriptionKind.SUBSCRIPTION, planName: "Business Starter (50 seats)", cost:  300000, billingCycle: BillingCycle.MONTHLY, startDate: new Date("2023-09-01"), renewalDate: nextMonth,  status: SubscriptionStatus.ACTIVE,        responsibleId: acc.id,   notes: "Email and collaboration for all staff", autoRenew: true           },
    { vendorId: createdVendors["notion"],           kind: SubscriptionKind.MEMBERSHIP,   planName: "Notion Business — Team Hub",  cost:   96000, billingCycle: BillingCycle.YEARLY,  startDate: new Date("2025-04-01"), renewalDate: nextYear,   status: SubscriptionStatus.ACTIVE,        responsibleId: ops.id,   notes: "Company knowledge base and wikis"                                 },
    { vendorId: createdVendors["citibank"],         kind: SubscriptionKind.CARD,         planName: "Citi Corporate Platinum",     cost:    5000, billingCycle: BillingCycle.YEARLY,  startDate: new Date("2023-08-01"), renewalDate: cardExpiry, status: SubscriptionStatus.ACTIVE,        responsibleId: acc.id,   notes: "Main corporate card for vendor payments", cardBrand: "Visa", cardLast4: "4242" },
    { vendorId: createdVendors["cleanpro"],         kind: SubscriptionKind.CONTRACT,     planName: "Office Cleaning Contract",    cost:   80000, billingCycle: BillingCycle.MONTHLY, startDate: new Date("2025-01-01"), renewalDate: in3Months,  status: SubscriptionStatus.ACTIVE,        responsibleId: ops.id,   notes: "Daily cleaning, 5 days a week"                                    },
    { vendorId: createdVendors["securenet"],        kind: SubscriptionKind.CONTRACT,     planName: "IT Support Retainer",         cost:  200000, billingCycle: BillingCycle.MONTHLY, startDate: new Date("2024-11-01"), renewalDate: in6Months,  status: SubscriptionStatus.ACTIVE,        responsibleId: ops.id,   notes: "24/7 helpdesk + on-site 4-hour SLA"                               },
    { vendorId: createdVendors["wework"],           kind: SubscriptionKind.LEASE,        planName: "Head Office — Floor 12",      cost: 1500000, billingCycle: BillingCycle.MONTHLY, startDate: new Date("2024-01-01"), renewalDate: in2Years,   status: SubscriptionStatus.ACTIVE,        responsibleId: admin.id, notes: "20 desks, 2 meeting rooms, WeWork Uptown"                         },
    { vendorId: createdVendors["ministry-finance"], kind: SubscriptionKind.LICENSE,      planName: "Annual Government License",   cost:  500000, billingCycle: BillingCycle.YEARLY,  startDate: new Date("2025-01-01"), renewalDate: yesterday,  status: SubscriptionStatus.EXPIRED,       responsibleId: ops.id,   notes: "License for compliance reporting portal — NEEDS RENEWAL"          },
    { vendorId: createdVendors["axa"],              kind: SubscriptionKind.INSURANCE,    planName: "Office All-Risk Insurance",   cost:  360000, billingCycle: BillingCycle.YEARLY,  startDate: new Date("2025-01-01"), renewalDate: nextYear,   status: SubscriptionStatus.ACTIVE,        responsibleId: acc.id,   notes: "Covers office equipment, fire, and liability"                     },
    { vendorId: createdVendors["axa"],              kind: SubscriptionKind.INSURANCE,    planName: "Group Health Plan (30 pax)",  cost:  900000, billingCycle: BillingCycle.YEARLY,  startDate: new Date("2025-03-01"), renewalDate: in14Days,   status: SubscriptionStatus.EXPIRING_SOON, responsibleId: acc.id,   notes: "Employee health coverage — renewal quote pending"                  },
    { vendorId: createdVendors["godaddy"],          kind: SubscriptionKind.DOMAIN,       planName: "krawma.com",                  cost:    1500, billingCycle: BillingCycle.YEARLY,  startDate: new Date("2020-05-01"), renewalDate: in3Months,  status: SubscriptionStatus.ACTIVE,        responsibleId: ops.id,   notes: "Primary company domain — auto-renew on", autoRenew: true           },
    { vendorId: createdVendors["godaddy"],          kind: SubscriptionKind.DOMAIN,       planName: "krawma.io (brand protect)",   cost:    1200, billingCycle: BillingCycle.YEARLY,  startDate: new Date("2022-05-01"), renewalDate: in3Months,  status: SubscriptionStatus.ACTIVE,        responsibleId: ops.id,   notes: "Brand protection domain — redirects to main site"                 },
    { vendorId: createdVendors["digitalocean"],     kind: SubscriptionKind.DOMAIN,       planName: "Wildcard SSL Certificate",    cost:    9900, billingCycle: BillingCycle.YEARLY,  startDate: new Date("2025-02-01"), renewalDate: in7Days,    status: SubscriptionStatus.EXPIRING_SOON, responsibleId: ops.id,   notes: "Covers *.krawma.com — urgent renewal needed"                      },
    { vendorId: createdVendors["city-hall"],        kind: SubscriptionKind.PERMIT,       planName: "Business Operating Permit",   cost:   25000, billingCycle: BillingCycle.YEARLY,  startDate: new Date("2025-01-01"), renewalDate: nextYear,   status: SubscriptionStatus.ACTIVE,        responsibleId: admin.id, notes: "Required to legally operate at current address"                   },
    { vendorId: createdVendors["city-hall"],        kind: SubscriptionKind.PERMIT,       planName: "Fire Safety Certificate",     cost:    8000, billingCycle: BillingCycle.YEARLY,  startDate: new Date("2024-06-01"), renewalDate: in6Months,  status: SubscriptionStatus.ACTIVE,        responsibleId: ops.id,   notes: "Annual fire safety inspection sign-off"                           },
    { vendorId: createdVendors["cleanpro"],         kind: SubscriptionKind.OTHER,        planName: "Pantry Supplies Arrangement", cost:   12000, billingCycle: BillingCycle.MONTHLY, startDate: new Date("2025-02-01"), renewalDate: nextMonth,  status: SubscriptionStatus.ACTIVE,        responsibleId: ops.id,   notes: "Monthly restocking of pantry consumables"                         },
  ]

  for (const sub of subscriptions) {
    await db.subscription.create({ data: sub })
    console.log("  ✓ Subscription: " + sub.planName)
  }

  console.log("\nSeed complete.")
  console.log("  Login is handled by dashboard.krawma.com — no local credentials needed.")
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => db.$disconnect())
