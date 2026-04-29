/**
 * Senior QA — createSubscription modal: all 10 kinds × all billing cycles
 * Cambodia company context: covers SaaS, memberships, cards, contracts,
 * leases, trade licenses, business permits, domains, insurance, and misc.
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))

vi.mock("@/lib/db", () => ({
  db: {
    subscription: {
      create:     vi.fn(),
      update:     vi.fn(),
      findUnique: vi.fn(),
      delete:     vi.fn(),
    },
    notificationConfig: {
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
    renewalLog: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}))

const mockAuth = vi.mocked(auth)
const mockDb   = vi.mocked(db)

function session() {
  return { user: { isAdmin: false, id: "user-kh-1", email: "ops@krawma.com.kh" } } as any
}

function okCreate() {
  vi.mocked(mockDb.subscription.create).mockResolvedValueOnce({ id: "sub-new" } as any)
}

// Baseline valid form for a given kind + cycle
function baseForm(overrides: Record<string, string> = {}): FormData {
  const fd = new FormData()
  fd.set("vendorId",     "vendor-1")
  fd.set("planName",     "Pro Plan")
  fd.set("kind",         "SUBSCRIPTION")
  fd.set("cost",         "150.00")
  fd.set("billingCycle", "MONTHLY")
  fd.set("startDate",    "2026-01-01")
  fd.set("renewalDate",  "2026-02-01")
  for (const [k, v] of Object.entries(overrides)) fd.set(k, v)
  return fd
}

const { createSubscription } = await import("@/app/actions/subscriptions")

// ─── Auth guard ───────────────────────────────────────────────────────────────

describe("createSubscription — auth guard", () => {
  beforeEach(() => vi.clearAllMocks())

  it("rejects unauthenticated request", async () => {
    mockAuth.mockResolvedValueOnce(null as any)
    expect(await createSubscription(new FormData())).toEqual({ error: "Unauthorized" })
  })
})

// ─── Required field validation ────────────────────────────────────────────────

describe("createSubscription — required field validation", () => {
  beforeEach(() => vi.clearAllMocks())

  it("rejects missing vendorId", async () => {
    mockAuth.mockResolvedValueOnce(session())
    const fd = baseForm(); fd.delete("vendorId")
    expect(await createSubscription(fd)).toEqual({ error: "Vendor is required" })
  })

  it("rejects missing planName", async () => {
    mockAuth.mockResolvedValueOnce(session())
    const fd = baseForm(); fd.delete("planName")
    expect(await createSubscription(fd)).toEqual({ error: "Plan / service name is required" })
  })

  it("rejects missing startDate", async () => {
    mockAuth.mockResolvedValueOnce(session())
    const fd = baseForm(); fd.delete("startDate")
    expect(await createSubscription(fd)).toEqual({ error: "Start date is required" })
  })

  it("rejects missing renewalDate", async () => {
    mockAuth.mockResolvedValueOnce(session())
    const fd = baseForm(); fd.delete("renewalDate")
    expect(await createSubscription(fd)).toEqual({ error: "Renewal date is required" })
  })

  it("rejects renewalDate on same day as startDate", async () => {
    mockAuth.mockResolvedValueOnce(session())
    const fd = baseForm({ startDate: "2026-03-01", renewalDate: "2026-03-01" })
    expect(await createSubscription(fd)).toEqual({ error: "Renewal date must be after start date" })
  })

  it("rejects renewalDate before startDate", async () => {
    mockAuth.mockResolvedValueOnce(session())
    const fd = baseForm({ startDate: "2026-06-01", renewalDate: "2026-01-01" })
    expect(await createSubscription(fd)).toEqual({ error: "Renewal date must be after start date" })
  })

  it("rejects non-numeric cost", async () => {
    mockAuth.mockResolvedValueOnce(session())
    const fd = baseForm({ cost: "not-a-number" })
    expect(await createSubscription(fd)).toEqual({ error: "Invalid cost amount" })
  })

  it("rejects negative cost", async () => {
    mockAuth.mockResolvedValueOnce(session())
    const fd = baseForm({ cost: "-50" })
    expect(await createSubscription(fd)).toEqual({ error: "Invalid cost amount" })
  })

  it("rejects CUSTOM billing cycle without customDays", async () => {
    mockAuth.mockResolvedValueOnce(session())
    const fd = baseForm({ billingCycle: "CUSTOM", renewalDate: "2026-04-01" })
    expect(await createSubscription(fd)).toEqual({ error: "Custom duration (days) is required" })
  })
})

// ─── Kind: SUBSCRIPTION (SaaS — e.g. Adobe, Slack, Google Workspace) ─────────

describe("createSubscription — kind: SUBSCRIPTION", () => {
  beforeEach(() => vi.clearAllMocks())

  it("creates monthly SaaS subscription successfully", async () => {
    mockAuth.mockResolvedValueOnce(session()); okCreate()
    const fd = baseForm({ kind: "SUBSCRIPTION", billingCycle: "MONTHLY", cost: "29.99", department: "IT" })
    const result = await createSubscription(fd)
    expect(result).toEqual({ success: true })
    expect(mockDb.subscription.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ kind: "SUBSCRIPTION", billingCycle: "MONTHLY", cost: 2999 }),
      })
    )
  })

  it("creates yearly SaaS subscription (Google Workspace)", async () => {
    mockAuth.mockResolvedValueOnce(session()); okCreate()
    const fd = baseForm({
      kind: "SUBSCRIPTION", billingCycle: "YEARLY",
      planName: "Google Workspace Business Starter",
      cost: "720.00", startDate: "2026-01-01", renewalDate: "2027-01-01",
      department: "IT",
    })
    expect(await createSubscription(fd)).toEqual({ success: true })
  })

  it("creates quarterly subscription (Quarterly hosting)", async () => {
    mockAuth.mockResolvedValueOnce(session()); okCreate()
    const fd = baseForm({
      kind: "SUBSCRIPTION", billingCycle: "QUARTERLY",
      startDate: "2026-01-01", renewalDate: "2026-04-01",
    })
    expect(await createSubscription(fd)).toEqual({ success: true })
  })

  it("creates semester subscription", async () => {
    mockAuth.mockResolvedValueOnce(session()); okCreate()
    const fd = baseForm({
      kind: "SUBSCRIPTION", billingCycle: "SEMESTER",
      startDate: "2026-01-01", renewalDate: "2026-07-01",
    })
    expect(await createSubscription(fd)).toEqual({ success: true })
  })

  it("creates one-time subscription (setup fee)", async () => {
    mockAuth.mockResolvedValueOnce(session()); okCreate()
    const fd = baseForm({
      kind: "SUBSCRIPTION", billingCycle: "ONE_TIME",
      planName: "ERP Implementation Fee",
      startDate: "2026-01-01", renewalDate: "2026-12-31",
    })
    expect(await createSubscription(fd)).toEqual({ success: true })
  })

  it("creates custom-cycle subscription (90 days)", async () => {
    mockAuth.mockResolvedValueOnce(session()); okCreate()
    const fd = baseForm({
      kind: "SUBSCRIPTION", billingCycle: "CUSTOM", customDays: "90",
      startDate: "2026-01-01", renewalDate: "2026-04-01",
    })
    const result = await createSubscription(fd)
    expect(result).toEqual({ success: true })
    expect(mockDb.subscription.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ billingCycle: "CUSTOM", customDays: 90 }),
      })
    )
  })

  it("stores cost as cents (150.50 USD → 15050 cents)", async () => {
    mockAuth.mockResolvedValueOnce(session()); okCreate()
    const fd = baseForm({ cost: "150.50" })
    await createSubscription(fd)
    expect(mockDb.subscription.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ cost: 15050 }) })
    )
  })

  it("stores zero cost when cost is omitted", async () => {
    mockAuth.mockResolvedValueOnce(session()); okCreate()
    const fd = baseForm(); fd.delete("cost")
    await createSubscription(fd)
    expect(mockDb.subscription.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ cost: 0 }) })
    )
  })
})

// ─── Kind: MEMBERSHIP (industry associations, co-working, chambers) ───────────

describe("createSubscription — kind: MEMBERSHIP", () => {
  beforeEach(() => vi.clearAllMocks())

  it("creates yearly membership (EuroCham Cambodia)", async () => {
    mockAuth.mockResolvedValueOnce(session()); okCreate()
    const fd = baseForm({
      kind: "MEMBERSHIP", billingCycle: "YEARLY",
      planName: "EuroCham Corporate Member",
      cost: "2500.00", startDate: "2026-01-01", renewalDate: "2027-01-01",
      department: "MANAGEMENT",
    })
    expect(await createSubscription(fd)).toEqual({ success: true })
    expect(mockDb.subscription.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ kind: "MEMBERSHIP" }) })
    )
  })

  it("creates monthly membership (co-working space)", async () => {
    mockAuth.mockResolvedValueOnce(session()); okCreate()
    const fd = baseForm({
      kind: "MEMBERSHIP", billingCycle: "MONTHLY",
      planName: "Coworking Space Desk Pass", department: "HR",
    })
    expect(await createSubscription(fd)).toEqual({ success: true })
  })

  it("creates one-time membership registration", async () => {
    mockAuth.mockResolvedValueOnce(session()); okCreate()
    const fd = baseForm({
      kind: "MEMBERSHIP", billingCycle: "ONE_TIME",
      planName: "CAMFEBA Lifetime Registration",
      startDate: "2026-01-01", renewalDate: "2026-12-31",
    })
    expect(await createSubscription(fd)).toEqual({ success: true })
  })
})

// ─── Kind: CARD (corporate credit/debit cards) ────────────────────────────────

describe("createSubscription — kind: CARD", () => {
  beforeEach(() => vi.clearAllMocks())

  it("creates CARD with valid last 4 digits and brand", async () => {
    mockAuth.mockResolvedValueOnce(session()); okCreate()
    const fd = baseForm({
      kind: "CARD", billingCycle: "ONE_TIME",
      planName: "ABA Bank Visa Corporate",
      cardBrand: "VISA", cardLast4: "4242",
      startDate: "2026-01-01", renewalDate: "2028-01-01",
      department: "FINANCE",
    })
    const result = await createSubscription(fd)
    expect(result).toEqual({ success: true })
    expect(mockDb.subscription.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ kind: "CARD", cardBrand: "VISA", cardLast4: "4242" }),
      })
    )
  })

  it("rejects cardLast4 with fewer than 4 digits", async () => {
    mockAuth.mockResolvedValueOnce(session())
    const fd = baseForm({
      kind: "CARD", billingCycle: "ONE_TIME",
      planName: "ABA Mastercard", cardBrand: "Mastercard", cardLast4: "12",
      startDate: "2026-01-01", renewalDate: "2028-01-01",
    })
    expect(await createSubscription(fd)).toEqual({ error: "Card last 4 must be exactly 4 digits" })
  })

  it("rejects cardLast4 with more than 4 digits", async () => {
    mockAuth.mockResolvedValueOnce(session())
    const fd = baseForm({
      kind: "CARD", billingCycle: "ONE_TIME",
      planName: "ABA Mastercard", cardBrand: "Mastercard", cardLast4: "12345",
      startDate: "2026-01-01", renewalDate: "2028-01-01",
    })
    expect(await createSubscription(fd)).toEqual({ error: "Card last 4 must be exactly 4 digits" })
  })

  it("rejects cardLast4 with letters", async () => {
    mockAuth.mockResolvedValueOnce(session())
    const fd = baseForm({
      kind: "CARD", billingCycle: "ONE_TIME",
      planName: "ABA Card", cardBrand: "AMEX", cardLast4: "AB12",
      startDate: "2026-01-01", renewalDate: "2028-01-01",
    })
    expect(await createSubscription(fd)).toEqual({ error: "Card last 4 must be exactly 4 digits" })
  })

  it("creates CARD without optional cardBrand/cardLast4", async () => {
    mockAuth.mockResolvedValueOnce(session()); okCreate()
    const fd = baseForm({
      kind: "CARD", billingCycle: "ONE_TIME",
      planName: "Canadia Bank Card",
      startDate: "2026-01-01", renewalDate: "2028-01-01",
    })
    expect(await createSubscription(fd)).toEqual({ success: true })
  })

  it("creates CARD with all-digits last 4 for Cambodian bank", async () => {
    mockAuth.mockResolvedValueOnce(session()); okCreate()
    const fd = baseForm({
      kind: "CARD", billingCycle: "ONE_TIME",
      planName: "Wing Bank UnionPay", cardBrand: "UnionPay", cardLast4: "0001",
      startDate: "2026-02-01", renewalDate: "2028-02-01",
    })
    expect(await createSubscription(fd)).toEqual({ success: true })
  })
})

// ─── Kind: CONTRACT (cleaning, security, maintenance) ─────────────────────────

describe("createSubscription — kind: CONTRACT", () => {
  beforeEach(() => vi.clearAllMocks())

  it("creates yearly cleaning service contract", async () => {
    mockAuth.mockResolvedValueOnce(session()); okCreate()
    const fd = baseForm({
      kind: "CONTRACT", billingCycle: "YEARLY",
      planName: "Office Cleaning Contract", cost: "3600.00",
      startDate: "2026-01-01", renewalDate: "2027-01-01",
      department: "OPERATIONS",
    })
    expect(await createSubscription(fd)).toEqual({ success: true })
    expect(mockDb.subscription.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ kind: "CONTRACT" }) })
    )
  })

  it("creates monthly security guard contract", async () => {
    mockAuth.mockResolvedValueOnce(session()); okCreate()
    const fd = baseForm({
      kind: "CONTRACT", billingCycle: "MONTHLY",
      planName: "Security Guard Service", cost: "800.00",
      department: "OPERATIONS",
    })
    expect(await createSubscription(fd)).toEqual({ success: true })
  })

  it("creates custom 180-day maintenance contract", async () => {
    mockAuth.mockResolvedValueOnce(session()); okCreate()
    const fd = baseForm({
      kind: "CONTRACT", billingCycle: "CUSTOM", customDays: "180",
      planName: "HVAC Maintenance", cost: "1200.00",
      startDate: "2026-01-01", renewalDate: "2026-07-01",
      department: "OPERATIONS",
    })
    expect(await createSubscription(fd)).toEqual({ success: true })
  })

  it("creates one-time project contract", async () => {
    mockAuth.mockResolvedValueOnce(session()); okCreate()
    const fd = baseForm({
      kind: "CONTRACT", billingCycle: "ONE_TIME",
      planName: "Website Redesign Project",
      startDate: "2026-01-01", renewalDate: "2026-06-30",
    })
    expect(await createSubscription(fd)).toEqual({ success: true })
  })
})

// ─── Kind: LEASE (office, warehouse, vehicle) ─────────────────────────────────

describe("createSubscription — kind: LEASE", () => {
  beforeEach(() => vi.clearAllMocks())

  it("creates yearly office lease (Phnom Penh head office)", async () => {
    mockAuth.mockResolvedValueOnce(session()); okCreate()
    const fd = baseForm({
      kind: "LEASE", billingCycle: "YEARLY",
      planName: "Head Office — Floor 3, Phnom Penh Tower",
      cost: "24000.00", startDate: "2026-01-01", renewalDate: "2027-01-01",
      department: "MANAGEMENT",
    })
    expect(await createSubscription(fd)).toEqual({ success: true })
    expect(mockDb.subscription.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ kind: "LEASE", cost: 2400000 }) })
    )
  })

  it("creates monthly warehouse lease (Siem Reap)", async () => {
    mockAuth.mockResolvedValueOnce(session()); okCreate()
    const fd = baseForm({
      kind: "LEASE", billingCycle: "MONTHLY",
      planName: "Warehouse Unit 7 — Siem Reap",
      cost: "1500.00", department: "OPERATIONS",
    })
    expect(await createSubscription(fd)).toEqual({ success: true })
  })

  it("creates custom 365-day land lease", async () => {
    mockAuth.mockResolvedValueOnce(session()); okCreate()
    const fd = baseForm({
      kind: "LEASE", billingCycle: "CUSTOM", customDays: "365",
      planName: "Land Parcel — Kampong Cham",
      startDate: "2026-01-01", renewalDate: "2027-01-01",
    })
    expect(await createSubscription(fd)).toEqual({ success: true })
  })

  it("rejects lease with renewalDate same as startDate", async () => {
    mockAuth.mockResolvedValueOnce(session())
    const fd = baseForm({
      kind: "LEASE", billingCycle: "ONE_TIME",
      planName: "Short-term Showroom",
      startDate: "2026-03-01", renewalDate: "2026-03-01",
    })
    expect(await createSubscription(fd)).toEqual({ error: "Renewal date must be after start date" })
  })
})

// ─── Kind: LICENSE (trade license, software, AutoCAD) ─────────────────────────

describe("createSubscription — kind: LICENSE", () => {
  beforeEach(() => vi.clearAllMocks())

  it("creates yearly trade license (MOC Cambodia)", async () => {
    mockAuth.mockResolvedValueOnce(session()); okCreate()
    const fd = baseForm({
      kind: "LICENSE", billingCycle: "YEARLY",
      planName: "Trade License — MOC", cost: "500.00",
      startDate: "2026-01-01", renewalDate: "2027-01-01",
      department: "LEGAL",
    })
    expect(await createSubscription(fd)).toEqual({ success: true })
    expect(mockDb.subscription.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ kind: "LICENSE" }) })
    )
  })

  it("creates yearly software license (AutoCAD)", async () => {
    mockAuth.mockResolvedValueOnce(session()); okCreate()
    const fd = baseForm({
      kind: "LICENSE", billingCycle: "YEARLY",
      planName: "AutoCAD 2026 License", cost: "2200.00",
      startDate: "2026-01-01", renewalDate: "2027-01-01",
      department: "IT",
    })
    expect(await createSubscription(fd)).toEqual({ success: true })
  })

  it("creates one-time permanent license", async () => {
    mockAuth.mockResolvedValueOnce(session()); okCreate()
    const fd = baseForm({
      kind: "LICENSE", billingCycle: "ONE_TIME",
      planName: "Perpetual ERP License",
      startDate: "2026-01-01", renewalDate: "2099-12-31",
    })
    expect(await createSubscription(fd)).toEqual({ success: true })
  })
})

// ─── Kind: INSURANCE ─────────────────────────────────────────────────────────

describe("createSubscription — kind: INSURANCE", () => {
  beforeEach(() => vi.clearAllMocks())

  it("creates yearly health insurance policy", async () => {
    mockAuth.mockResolvedValueOnce(session()); okCreate()
    const fd = baseForm({
      kind: "INSURANCE", billingCycle: "YEARLY",
      planName: "Group Health Insurance — Prudential",
      cost: "12000.00", startDate: "2026-01-01", renewalDate: "2027-01-01",
      department: "HR",
    })
    expect(await createSubscription(fd)).toEqual({ success: true })
    expect(mockDb.subscription.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ kind: "INSURANCE" }) })
    )
  })

  it("creates yearly fire & property insurance", async () => {
    mockAuth.mockResolvedValueOnce(session()); okCreate()
    const fd = baseForm({
      kind: "INSURANCE", billingCycle: "YEARLY",
      planName: "Office Fire & Property Insurance",
      cost: "3600.00", startDate: "2026-01-01", renewalDate: "2027-01-01",
      department: "FINANCE",
    })
    expect(await createSubscription(fd)).toEqual({ success: true })
  })

  it("creates monthly workmen's compensation insurance", async () => {
    mockAuth.mockResolvedValueOnce(session()); okCreate()
    const fd = baseForm({
      kind: "INSURANCE", billingCycle: "MONTHLY",
      planName: "Workmen's Compensation",
      cost: "450.00", department: "HR",
    })
    expect(await createSubscription(fd)).toEqual({ success: true })
  })

  it("creates custom-period vehicle insurance (180 days)", async () => {
    mockAuth.mockResolvedValueOnce(session()); okCreate()
    const fd = baseForm({
      kind: "INSURANCE", billingCycle: "CUSTOM", customDays: "180",
      planName: "Company Vehicle Insurance",
      cost: "900.00", startDate: "2026-01-01", renewalDate: "2026-07-01",
    })
    expect(await createSubscription(fd)).toEqual({ success: true })
  })
})

// ─── Kind: DOMAIN (domain names, hosting, SSL) ────────────────────────────────

describe("createSubscription — kind: DOMAIN", () => {
  beforeEach(() => vi.clearAllMocks())

  it("creates yearly .com.kh domain registration", async () => {
    mockAuth.mockResolvedValueOnce(session()); okCreate()
    const fd = baseForm({
      kind: "DOMAIN", billingCycle: "YEARLY",
      planName: "krawma.com.kh — NIC.kh",
      cost: "30.00", startDate: "2026-01-01", renewalDate: "2027-01-01",
      department: "IT",
    })
    expect(await createSubscription(fd)).toEqual({ success: true })
    expect(mockDb.subscription.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ kind: "DOMAIN" }) })
    )
  })

  it("creates yearly SSL certificate", async () => {
    mockAuth.mockResolvedValueOnce(session()); okCreate()
    const fd = baseForm({
      kind: "DOMAIN", billingCycle: "YEARLY",
      planName: "Wildcard SSL Certificate — DigiCert",
      cost: "350.00", startDate: "2026-01-01", renewalDate: "2027-01-01",
      department: "IT",
    })
    expect(await createSubscription(fd)).toEqual({ success: true })
  })

  it("creates monthly web hosting plan", async () => {
    mockAuth.mockResolvedValueOnce(session()); okCreate()
    const fd = baseForm({
      kind: "DOMAIN", billingCycle: "MONTHLY",
      planName: "VPS Hosting — DigitalOcean",
      cost: "48.00", department: "IT",
    })
    expect(await createSubscription(fd)).toEqual({ success: true })
  })

  it("creates 2-year domain registration (custom 730 days)", async () => {
    mockAuth.mockResolvedValueOnce(session()); okCreate()
    const fd = baseForm({
      kind: "DOMAIN", billingCycle: "CUSTOM", customDays: "730",
      planName: "krawma.com — Namecheap 2Y",
      cost: "24.00", startDate: "2026-01-01", renewalDate: "2028-01-01",
    })
    expect(await createSubscription(fd)).toEqual({ success: true })
  })
})

// ─── Kind: PERMIT (business permit, health cert, environmental cert) ──────────

describe("createSubscription — kind: PERMIT", () => {
  beforeEach(() => vi.clearAllMocks())

  it("creates yearly business permit (Khan Daun Penh)", async () => {
    mockAuth.mockResolvedValueOnce(session()); okCreate()
    const fd = baseForm({
      kind: "PERMIT", billingCycle: "YEARLY",
      planName: "Business Permit — Khan Daun Penh",
      cost: "200.00", startDate: "2026-01-01", renewalDate: "2027-01-01",
      department: "LEGAL",
    })
    expect(await createSubscription(fd)).toEqual({ success: true })
    expect(mockDb.subscription.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ kind: "PERMIT" }) })
    )
  })

  it("creates yearly health certificate (MOH Cambodia)", async () => {
    mockAuth.mockResolvedValueOnce(session()); okCreate()
    const fd = baseForm({
      kind: "PERMIT", billingCycle: "YEARLY",
      planName: "Health Certificate — MOH",
      cost: "150.00", startDate: "2026-01-01", renewalDate: "2027-01-01",
      department: "LEGAL",
    })
    expect(await createSubscription(fd)).toEqual({ success: true })
  })

  it("creates biannual environmental permit (semester)", async () => {
    mockAuth.mockResolvedValueOnce(session()); okCreate()
    const fd = baseForm({
      kind: "PERMIT", billingCycle: "SEMESTER",
      planName: "Environmental Compliance Permit",
      cost: "400.00", startDate: "2026-01-01", renewalDate: "2026-07-01",
      department: "OPERATIONS",
    })
    expect(await createSubscription(fd)).toEqual({ success: true })
  })

  it("creates one-time import permit", async () => {
    mockAuth.mockResolvedValueOnce(session()); okCreate()
    const fd = baseForm({
      kind: "PERMIT", billingCycle: "ONE_TIME",
      planName: "Import Permit — Customs",
      startDate: "2026-01-01", renewalDate: "2026-06-30",
    })
    expect(await createSubscription(fd)).toEqual({ success: true })
  })
})

// ─── Kind: OTHER ───────────────────────────────────────────────────────────────

describe("createSubscription — kind: OTHER", () => {
  beforeEach(() => vi.clearAllMocks())

  it("creates miscellaneous yearly item", async () => {
    mockAuth.mockResolvedValueOnce(session()); okCreate()
    const fd = baseForm({
      kind: "OTHER", billingCycle: "YEARLY",
      planName: "Annual Conference Fee",
      cost: "600.00", startDate: "2026-01-01", renewalDate: "2027-01-01",
    })
    expect(await createSubscription(fd)).toEqual({ success: true })
    expect(mockDb.subscription.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ kind: "OTHER" }) })
    )
  })

  it("falls back to SUBSCRIPTION kind for unknown kind value", async () => {
    mockAuth.mockResolvedValueOnce(session()); okCreate()
    const fd = baseForm({ kind: "INVALID_KIND" })
    await createSubscription(fd)
    expect(mockDb.subscription.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ kind: "SUBSCRIPTION" }) })
    )
  })
})

// ─── Optional fields: departments, notes, document, autoRenew ─────────────────

describe("createSubscription — optional field handling", () => {
  beforeEach(() => vi.clearAllMocks())

  const DEPARTMENTS = ["IT", "FINANCE", "OPERATIONS", "HR", "MARKETING", "SALES", "LEGAL", "MANAGEMENT", "SUPPORT", "PROCUREMENT"]

  for (const dept of DEPARTMENTS) {
    it(`creates subscription with department: ${dept}`, async () => {
      mockAuth.mockResolvedValueOnce(session()); okCreate()
      const fd = baseForm({ department: dept })
      expect(await createSubscription(fd)).toEqual({ success: true })
    })
  }

  it("stores null for empty department", async () => {
    mockAuth.mockResolvedValueOnce(session()); okCreate()
    const fd = baseForm(); fd.set("department", "")
    await createSubscription(fd)
    expect(mockDb.subscription.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ department: null }) })
    )
  })

  it("stores notes when provided", async () => {
    mockAuth.mockResolvedValueOnce(session()); okCreate()
    const fd = baseForm({ notes: "Contract signed by CEO — see Nextcloud." })
    await createSubscription(fd)
    expect(mockDb.subscription.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ notes: "Contract signed by CEO — see Nextcloud." }) })
    )
  })

  it("stores documentPath URL", async () => {
    mockAuth.mockResolvedValueOnce(session()); okCreate()
    const fd = baseForm({ documentPath: "https://nextcloud.krawma.com/IT/contracts/adobe.pdf" })
    await createSubscription(fd)
    expect(mockDb.subscription.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ documentPath: "https://nextcloud.krawma.com/IT/contracts/adobe.pdf" }),
      })
    )
  })

  it("stores documentPath as relative path", async () => {
    mockAuth.mockResolvedValueOnce(session()); okCreate()
    const fd = baseForm({ documentPath: "IT/contracts/adobe.pdf" })
    await createSubscription(fd)
    expect(mockDb.subscription.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ documentPath: "IT/contracts/adobe.pdf" }) })
    )
  })

  it("sets autoRenew = true when checkbox is on", async () => {
    mockAuth.mockResolvedValueOnce(session()); okCreate()
    const fd = baseForm(); fd.set("autoRenew", "on")
    await createSubscription(fd)
    expect(mockDb.subscription.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ autoRenew: true }) })
    )
  })

  it("sets autoRenew = false when checkbox is omitted", async () => {
    mockAuth.mockResolvedValueOnce(session()); okCreate()
    const fd = baseForm()
    await createSubscription(fd)
    expect(mockDb.subscription.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ autoRenew: false }) })
    )
  })

  it("stores responsibleId when provided", async () => {
    mockAuth.mockResolvedValueOnce(session()); okCreate()
    const fd = baseForm({ responsibleId: "user-kh-2" })
    await createSubscription(fd)
    expect(mockDb.subscription.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ responsibleId: "user-kh-2" }) })
    )
  })

  it("stores null responsibleId when not provided", async () => {
    mockAuth.mockResolvedValueOnce(session()); okCreate()
    const fd = baseForm()
    await createSubscription(fd)
    expect(mockDb.subscription.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ responsibleId: null }) })
    )
  })

  it("stores paymentMethodId when provided", async () => {
    mockAuth.mockResolvedValueOnce(session()); okCreate()
    const fd = baseForm({ paymentMethodId: "pm-aba-123" })
    await createSubscription(fd)
    expect(mockDb.subscription.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ paymentMethodId: "pm-aba-123" }) })
    )
  })
})

// ─── Extra reminders (long-lead chips) ────────────────────────────────────────

describe("createSubscription — extra reminder schedules", () => {
  beforeEach(() => vi.clearAllMocks())

  it("stores 30-day and 90-day extra reminders for yearly subscription", async () => {
    mockAuth.mockResolvedValueOnce(session()); okCreate()
    vi.mocked(mockDb.notificationConfig.deleteMany).mockResolvedValueOnce({} as any)
    vi.mocked(mockDb.notificationConfig.createMany).mockResolvedValueOnce({} as any)
    const fd = baseForm({ billingCycle: "YEARLY", startDate: "2026-01-01", renewalDate: "2027-01-01" })
    fd.append("extraReminders", "30")
    fd.append("extraReminders", "90")
    const result = await createSubscription(fd)
    expect(result).toEqual({ success: true })
  })

  it("ignores extra reminders with invalid values", async () => {
    mockAuth.mockResolvedValueOnce(session()); okCreate()
    const fd = baseForm({ billingCycle: "YEARLY", startDate: "2026-01-01", renewalDate: "2027-01-01" })
    fd.append("extraReminders", "999")
    fd.append("extraReminders", "abc")
    const result = await createSubscription(fd)
    expect(result).toEqual({ success: true })
  })
})

// ─── Cost precision edge cases ────────────────────────────────────────────────

describe("createSubscription — cost precision", () => {
  beforeEach(() => vi.clearAllMocks())

  const cases: [string, number][] = [
    ["0",       0],
    ["0.00",    0],
    ["0.01",    1],
    ["9.99",    999],
    ["100",     10000],
    ["1000.50", 100050],
    ["99999.99",9999999],
  ]

  for (const [input, expected] of cases) {
    it(`converts ${input} USD → ${expected} cents`, async () => {
      mockAuth.mockResolvedValueOnce(session()); okCreate()
      const fd = baseForm({ cost: input })
      await createSubscription(fd)
      expect(mockDb.subscription.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ cost: expected }) })
      )
    })
  }
})

// ─── Status defaults to ACTIVE on create ─────────────────────────────────────

describe("createSubscription — status default", () => {
  beforeEach(() => vi.clearAllMocks())

  it("always creates with status ACTIVE", async () => {
    mockAuth.mockResolvedValueOnce(session()); okCreate()
    const fd = baseForm()
    await createSubscription(fd)
    expect(mockDb.subscription.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "ACTIVE" }) })
    )
  })
})
