"use client"

import { useState, useTransition, useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  RiAddLine, RiSearchLine, RiFilterLine,
  RiArrowUpLine, RiArrowDownLine, RiCheckLine,
  RiLoader4Line, RiAlertLine, RiCloseLine,
  RiEditLine, RiDeleteBinLine, RiLink,
  RiCheckDoubleLine, RiHistoryLine, RiEyeLine,
} from "@remixicon/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Modal } from "@/components/ui/modal"
import { Combobox } from "@/components/ui/combobox"
import { createSubscription, updateSubscription, deleteSubscription, markAsRenewed } from "@/app/actions/subscriptions"
import { toast } from "react-hot-toast"
import type { Subscription, Vendor, User, NotificationConfig, PaymentMethod, SubscriptionKind } from "@prisma/client"
import { formatPaymentMethod, PAYMENT_METHOD_TYPE_LABELS } from "@/lib/payment-method-utils"

type PaymentMethodCreator = (name: string) => Promise<string | null>

type KindConfig = {
  value: SubscriptionKind
  label: string
  planLabel: string
  planPlaceholder: string
  vendorLabel: string
  autoRenewLabel: string
  autoRenewHint: string
  hideBillingCycle?: boolean
  hidePaymentMethod?: boolean
}

const KIND_OPTIONS: KindConfig[] = [
  { value: "SUBSCRIPTION", label: "Subscription / Service", planLabel: "Plan / Service Name", planPlaceholder: "e.g. Pro, Business, Enterprise",  vendorLabel: "Vendor",            autoRenewLabel: "Auto-renews with vendor",     autoRenewHint: "Skip reminder emails — the vendor renews this automatically." },
  { value: "MEMBERSHIP",   label: "Membership",             planLabel: "Membership Name",     planPlaceholder: "e.g. Gold tier, Premium",         vendorLabel: "Provider",          autoRenewLabel: "Auto-renews with provider",   autoRenewHint: "Skip reminder emails — the provider renews this automatically." },
  { value: "CARD",         label: "Card",                   planLabel: "Card Name",           planPlaceholder: "e.g. Marketing Visa",             vendorLabel: "Issuing Bank",      autoRenewLabel: "Bank auto-issues new card",   autoRenewHint: "Skip reminder emails — the bank sends a replacement before expiry.", hideBillingCycle: true, hidePaymentMethod: true },
  { value: "CONTRACT",     label: "Contract",               planLabel: "Contract Name",       planPlaceholder: "e.g. Cleaning service contract",  vendorLabel: "Contractor",        autoRenewLabel: "Auto-renews with contractor", autoRenewHint: "Skip reminder emails — the contractor renews this automatically." },
  { value: "LEASE",        label: "Lease",                  planLabel: "Lease Name",          planPlaceholder: "e.g. Head office — Floor 3",      vendorLabel: "Landlord",          autoRenewLabel: "Lease auto-renews",           autoRenewHint: "Skip reminder emails — the lease renews automatically." },
  { value: "LICENSE",      label: "License",                planLabel: "License Name",        planPlaceholder: "e.g. Trade license, AutoCAD",     vendorLabel: "Issuing Authority", autoRenewLabel: "Auto-renews with authority",  autoRenewHint: "Skip reminder emails — the authority renews this automatically." },
  { value: "OTHER",        label: "Other",                  planLabel: "Name",                planPlaceholder: "Name",                            vendorLabel: "Vendor",            autoRenewLabel: "Auto-renews",                 autoRenewHint: "Skip reminder emails — this renews automatically." },
]

function kindConfig(kind: string): KindConfig {
  return KIND_OPTIONS.find(k => k.value === kind) ?? KIND_OPTIONS[0]
}

type SubscriptionFull = Subscription & {
  vendor: Vendor
  responsible: User | null
  notificationConfigs: NotificationConfig[]
  paymentMethod: PaymentMethod | null
}

// ─── Reminder chips ───────────────────────────────────────────────────────────

const EXTRA_REMINDER_OPTIONS = [
  { days: 90, label: "3 months" },
  { days: 30, label: "1 month"  },
  { days: 14, label: "2 weeks"  },
] as const

function availableReminderDays(cycle: string, customDays: number | null, renewalDateStr: string): number[] {
  if (cycle === "MONTHLY") return []
  if (cycle === "QUARTERLY" || cycle === "SEMESTER" || cycle === "YEARLY") {
    return EXTRA_REMINDER_OPTIONS.map(o => o.days)
  }
  if (cycle === "CUSTOM") {
    if (!customDays || customDays <= 14) return []
    return EXTRA_REMINDER_OPTIONS.filter(o => o.days < customDays).map(o => o.days)
  }
  if (cycle === "ONE_TIME") {
    if (!renewalDateStr) return []
    const days = Math.ceil((new Date(renewalDateStr).getTime() - Date.now()) / 86_400_000)
    if (days <= 14) return []
    return EXTRA_REMINDER_OPTIONS.filter(o => o.days < days).map(o => o.days)
  }
  return []
}

function ReminderChips({
  cycle,
  customDays,
  renewalDateStr,
  selected,
  setSelected,
}: {
  cycle: string
  customDays: string
  renewalDateStr: string
  selected: number[]
  setSelected: (next: number[]) => void
}) {
  const cd = customDays ? parseInt(customDays) : null
  const allowed = availableReminderDays(cycle, cd, renewalDateStr)
  if (allowed.length === 0) return null

  function toggle(d: number) {
    setSelected(selected.includes(d) ? selected.filter(x => x !== d) : [...selected, d].sort((a, b) => b - a))
  }

  return (
    <div className="col-span-2 space-y-1.5">
      <label className="text-sm font-medium text-foreground">Reminder schedule <span className="text-xs font-normal text-muted-foreground">(optional)</span></label>
      <div className="flex flex-wrap gap-2">
        {EXTRA_REMINDER_OPTIONS.map(opt => {
          const valid    = allowed.includes(opt.days)
          if (!valid) return null
          const checked  = selected.includes(opt.days)
          return (
            <label
              key={opt.days}
              className={`cursor-pointer inline-flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-xs font-medium transition-colors ${
                checked ? "bg-primary text-white border-primary" : "bg-background text-muted-foreground hover:bg-muted"
              }`}
            >
              <input
                type="checkbox"
                name="extraReminders"
                value={opt.days}
                checked={checked}
                onChange={() => toggle(opt.days)}
                className="hidden"
              />
              {opt.label} before
            </label>
          )
        })}
      </div>
      <p className="text-xs text-muted-foreground">7-day, 3-day, and 1-day reminders are sent automatically — these are extra long-lead reminders for cycles longer than a month.</p>
    </div>
  )
}

// ─── Config ───────────────────────────────────────────────────────────────────

const statusConfig: Record<string, { label: string; className: string; icon: React.ComponentType<{ className?: string }> }> = {
  ACTIVE:         { label: "Active",         className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400", icon: RiCheckLine  },
  EXPIRING_SOON:  { label: "Expiring Soon",  className: "bg-amber-500/10 text-amber-600 dark:text-amber-400",      icon: RiAlertLine  },
  EXPIRED:        { label: "Expired",        className: "bg-destructive/10 text-destructive",                       icon: RiCloseLine  },
  CANCELLED:      { label: "Cancelled",      className: "bg-muted text-muted-foreground",                          icon: RiCloseLine  },
}

const cycleLabel: Record<string, string> = {
  MONTHLY: "Monthly", QUARTERLY: "Quarterly", SEMESTER: "Semester", YEARLY: "Yearly", ONE_TIME: "One-time", CUSTOM: "Custom",
}

const DEPARTMENTS: { value: string; label: string }[] = [
  { value: "IT",          label: "IT / Technology"         },
  { value: "FINANCE",     label: "Finance / Accounting"    },
  { value: "OPERATIONS",  label: "Operations"              },
  { value: "HR",          label: "Human Resources"         },
  { value: "MARKETING",   label: "Marketing"               },
  { value: "SALES",       label: "Sales"                   },
  { value: "LEGAL",       label: "Legal"                   },
  { value: "MANAGEMENT",  label: "Management / Executive"  },
  { value: "SUPPORT",     label: "Customer Support"        },
  { value: "PROCUREMENT", label: "Procurement"             },
]

function deptLabel(value: string | null | undefined) {
  if (!value) return null
  return DEPARTMENTS.find(d => d.value === value)?.label ?? value
}

const ALL_STATUSES = ["ACTIVE", "EXPIRING_SOON", "EXPIRED", "CANCELLED"]

type RenewalFilter = "ALL" | "OVERDUE" | "7D" | "30D" | "90D"
const RENEWAL_FILTERS: { value: RenewalFilter; label: string }[] = [
  { value: "ALL",     label: "All"          },
  { value: "OVERDUE", label: "Overdue"      },
  { value: "7D",      label: "Due 7 days"   },
  { value: "30D",     label: "Due 30 days"  },
  { value: "90D",     label: "Due 90 days"  },
]

function matchesRenewalFilter(sub: { renewalDate: Date | string; status: string }, f: RenewalFilter): boolean {
  if (f === "ALL") return true
  if (sub.status === "CANCELLED") return false
  const d = Math.ceil((new Date(sub.renewalDate).getTime() - Date.now()) / 86_400_000)
  if (f === "OVERDUE") return d < 0
  if (f === "7D")  return d <= 7
  if (f === "30D") return d <= 30
  if (f === "90D") return d <= 90
  return true
}

function fmt(n: number) { return `$${(n / 100).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}` }
function fmtDate(d: Date | string | null) {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}
function daysUntil(d: Date | string) {
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86_400_000)
}
function toInput(d: Date | string) { return new Date(d).toISOString().split("T")[0] }

// Auto-computes renewal date from a start date (YYYY-MM-DD) + cycle. UTC-safe.
// Returns "" for invalid input, or when ONE_TIME (caller manages that case).
function computeRenewalDate(startIso: string, cycle: string, customDays: number | null): string {
  if (!startIso) return ""
  const [y, m, d] = startIso.split("-").map(Number)
  if (!y || !m || !d) return ""
  const dt = new Date(Date.UTC(y, m - 1, d))
  switch (cycle) {
    case "MONTHLY":   dt.setUTCMonth(dt.getUTCMonth() + 1); break
    case "QUARTERLY": dt.setUTCMonth(dt.getUTCMonth() + 3); break
    case "SEMESTER":  dt.setUTCMonth(dt.getUTCMonth() + 6); break
    case "YEARLY":    dt.setUTCFullYear(dt.getUTCFullYear() + 1); break
    case "CUSTOM":
      if (!customDays || customDays < 1) return ""
      dt.setUTCDate(dt.getUTCDate() + customDays)
      break
    case "ONE_TIME":  return ""
    default:          return ""
  }
  return dt.toISOString().split("T")[0]
}

// ─── Add Modal ────────────────────────────────────────────────────────────────

function AddSubscriptionModal({
  vendors,
  users,
  paymentMethods,
  onCreatePaymentMethod,
  onClose,
  onSuccess,
}: {
  vendors: Vendor[]
  users: Pick<User, "id" | "name" | "email">[]
  paymentMethods: PaymentMethod[]
  onCreatePaymentMethod?: PaymentMethodCreator
  onClose: () => void
  onSuccess: () => void
}) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [today, setToday] = useState("")
  const [kind, setKind]                 = useState<SubscriptionKind>("SUBSCRIPTION")
  const [startDate, setStartDate]       = useState("")
  const [billingCycle, setBillingCycle] = useState<string>("MONTHLY")
  const [customDays, setCustomDays]     = useState("")
  const [renewalDate, setRenewalDate]   = useState("")
  const [extraReminders, setExtraReminders] = useState<number[]>([])

  useEffect(() => {
    const t = new Date().toISOString().split("T")[0]
    setToday(t)
    setStartDate(t)
  }, [])

  // Auto-update renewal date when start date or billing cycle changes.
  useEffect(() => {
    const days = customDays ? parseInt(customDays) : null
    const next = computeRenewalDate(startDate, billingCycle, days)
    if (next) setRenewalDate(next)
  }, [startDate, billingCycle, customDays])

  function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const formData = new FormData(e.currentTarget)
    const sd = formData.get("startDate") as string
    const rd = formData.get("renewalDate") as string
    if (sd && rd && new Date(rd) <= new Date(sd)) {
      setError("Renewal date must be after start date")
      return
    }
    startTransition(async () => {
      const result = await createSubscription(formData)
      if ("error" in result) { setError(result.error); toast.error("Failed to add renewal") }
      else { toast.success(`${kindConfig(kind).label} added`); onSuccess(); onClose() }
    })
  }

  const kindCfg = kindConfig(kind)

  return (
    <Modal title={`New ${kindCfg.label}`} onClose={onClose} size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}

        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2 space-y-1.5">
            <label className="text-sm font-medium text-foreground">Type <span className="text-destructive">*</span></label>
            <select
              name="kind"
              value={kind}
              onChange={e => {
                const next = e.target.value as SubscriptionKind
                setKind(next)
                if (next === "CARD") setBillingCycle("ONE_TIME")
                else if (kind === "CARD") setBillingCycle("MONTHLY")
              }}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {KIND_OPTIONS.map(k => <option key={k.value} value={k.value}>{k.label}</option>)}
            </select>
          </div>

          <div className="col-span-2 space-y-1.5">
            <label className="text-sm font-medium text-foreground">{kindCfg.planLabel} <span className="text-destructive">*</span></label>
            <Input name="planName" placeholder={kindCfg.planPlaceholder} required />
          </div>

          {kind === "CARD" && (
            <>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">Card Brand</label>
                <Input name="cardBrand" placeholder="VISA / Mastercard / AMEX" maxLength={50} />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">Last 4 digits</label>
                <Input name="cardLast4" inputMode="numeric" maxLength={4} placeholder="4242" />
              </div>
              <p className="col-span-2 -mt-2 text-xs text-muted-foreground">
                Renewal date below = card expiry. Never enter the full card number or CVV.
              </p>
            </>
          )}

          <div className="col-span-2 space-y-1.5">
            <label className="text-sm font-medium text-foreground">{kindCfg.vendorLabel} <span className="text-destructive">*</span></label>
            <Combobox
              name="vendorId"
              required
              options={vendors.map(v => ({ value: v.id, label: v.name }))}
              placeholder={`Select ${kindCfg.vendorLabel.toLowerCase()}…`}
              searchPlaceholder={`Search ${kindCfg.vendorLabel.toLowerCase()}…`}
              emptyMessage="No matches."
            />
          </div>

          <div className="col-span-2 space-y-1.5">
            <label className="text-sm font-medium text-foreground">Department</label>
            <select name="department" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring">
              <option value="">— None —</option>
              {DEPARTMENTS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">{kind === "CARD" ? "Annual Fee (USD)" : "Cost (USD)"}</label>
            <Input name="cost" type="number" min="0" step="0.01" placeholder="0.00" />
          </div>

          <input type="hidden" name="billingCycle" value={billingCycle} />
          {!kindCfg.hideBillingCycle && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Billing Cycle</label>
              <select
                value={billingCycle}
                onChange={e => setBillingCycle(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {Object.entries(cycleLabel).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
          )}

          {!kindCfg.hideBillingCycle && billingCycle === "CUSTOM" && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Custom Duration (days) <span className="text-destructive">*</span></label>
              <Input name="customDays" type="number" min="1" placeholder="e.g. 90" value={customDays} onChange={e => setCustomDays(e.target.value)} />
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Start Date <span className="text-destructive">*</span></label>
            <Input name="startDate" type="date" value={startDate || today} onChange={e => setStartDate(e.target.value)} required />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">
              {kind === "CARD" ? "Card Expiry" : "Renewal Date"} <span className="text-destructive">*</span>
              {billingCycle !== "ONE_TIME" && <span className="ml-1.5 text-xs font-normal text-muted-foreground">(auto)</span>}
            </label>
            <Input name="renewalDate" type="date" value={renewalDate} onChange={e => setRenewalDate(e.target.value)} required />
          </div>

          <div className="col-span-2 space-y-1.5">
            <label className="text-sm font-medium text-foreground">Responsible Person</label>
            <Combobox
              name="responsibleId"
              options={users.map(u => ({ value: u.id, label: u.name || u.email, searchText: u.email }))}
              placeholder="Unassigned"
              searchPlaceholder="Search users…"
              emptyMessage="No users match."
            />
          </div>

          {!kindCfg.hidePaymentMethod && (
            <div className="col-span-2 space-y-1.5">
              <label className="text-sm font-medium text-foreground">Payment Method</label>
              <Combobox
                name="paymentMethodId"
                options={paymentMethods.map(pm => ({ value: pm.id, label: formatPaymentMethod(pm) }))}
                placeholder="— None —"
                searchPlaceholder={onCreatePaymentMethod ? "Search or type a new payment method…" : "Search payment methods…"}
                emptyMessage="No payment methods match."
                onCreate={onCreatePaymentMethod}
                createLabel={q => `Create "${q}"`}
              />
            </div>
          )}

          <div className="col-span-2 space-y-1.5">
            <label className="text-sm font-medium text-foreground">Document Location</label>
            <Input name="documentPath" placeholder="e.g. https://nextcloud.krawma.com/IT/contracts/adobe.pdf or IT/contracts/adobe.pdf" />
            <p className="text-xs text-muted-foreground">URL or path to the contract/document in Nextcloud or other storage.</p>
          </div>

          <div className="col-span-2 space-y-1.5">
            <label className="text-sm font-medium text-foreground">Notes</label>
            <textarea name="notes" rows={2} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none" placeholder="Optional notes…" />
          </div>

          <div className="col-span-2 flex items-start gap-2">
            <input id="autoRenew-create" name="autoRenew" type="checkbox" className="mt-0.5 size-4 rounded border-border" />
            <label htmlFor="autoRenew-create" className="text-sm text-foreground">
              {kindCfg.autoRenewLabel}
              <span className="block text-xs text-muted-foreground">{kindCfg.autoRenewHint}</span>
            </label>
          </div>

          <ReminderChips
            cycle={billingCycle}
            customDays={customDays}
            renewalDateStr={renewalDate}
            selected={extraReminders}
            setSelected={setExtraReminders}
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>Cancel</Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? <><RiLoader4Line className="size-4 animate-spin" data-icon="inline-start" />Creating…</> : <><RiAddLine data-icon="inline-start" />Create {kindCfg.label}</>}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

// ─── Edit Modal ───────────────────────────────────────────────────────────────

function EditSubscriptionModal({
  sub,
  users,
  paymentMethods,
  onCreatePaymentMethod,
  onClose,
  onSuccess,
}: {
  sub: SubscriptionFull
  users: Pick<User, "id" | "name" | "email">[]
  paymentMethods: PaymentMethod[]
  onCreatePaymentMethod?: PaymentMethodCreator
  onClose: () => void
  onSuccess: () => void
}) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [kind, setKind]                 = useState<SubscriptionKind>(sub.kind)
  const [cardBrand, setCardBrand]       = useState(sub.cardBrand ?? "")
  const [cardLast4, setCardLast4]       = useState(sub.cardLast4 ?? "")
  const [startDate, setStartDate]       = useState(toInput(sub.startDate))
  const [billingCycle, setBillingCycle] = useState<string>(sub.billingCycle)
  const [customDays, setCustomDays]     = useState(sub.customDays?.toString() ?? "")
  const [renewalDate, setRenewalDate]   = useState(toInput(sub.renewalDate))
  const [extraReminders, setExtraReminders] = useState<number[]>(
    sub.notificationConfigs
      .map(c => c.daysBefore)
      .filter(d => EXTRA_REMINDER_OPTIONS.some(o => o.days === d))
      .sort((a, b) => b - a)
  )

  const recalcRenewal = (sd: string, cycle: string, days: string) => {
    const n = days ? parseInt(days) : null
    const next = computeRenewalDate(sd, cycle, n)
    if (next) setRenewalDate(next)
  }

  function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const fd = new FormData(e.currentTarget)
    const cost = fd.get("cost") as string
    const costCents = Math.round(parseFloat(cost || "0") * 100)
    const cycle = billingCycle as "MONTHLY" | "QUARTERLY" | "SEMESTER" | "YEARLY" | "ONE_TIME" | "CUSTOM"
    if (startDate && renewalDate && new Date(renewalDate) <= new Date(startDate)) {
      setError("Renewal date must be after start date")
      return
    }
    startTransition(async () => {
      const deptVal = fd.get("department") as string
      const result = await updateSubscription(sub.id, {
        planName:        fd.get("planName") as string,
        kind,
        department:      (deptVal || null) as import("@prisma/client").Department | null,
        cost:            costCents,
        billingCycle:    cycle,
        customDays:      cycle === "CUSTOM" && customDays ? parseInt(customDays) : null,
        startDate:       new Date(startDate),
        renewalDate:     new Date(renewalDate),
        status:          fd.get("status") as "ACTIVE" | "EXPIRING_SOON" | "EXPIRED" | "CANCELLED",
        responsibleId:   (fd.get("responsibleId") as string) || null,
        paymentMethodId: (fd.get("paymentMethodId") as string) || null,
        notes:           (fd.get("notes") as string) || null,
        documentPath:    (fd.get("documentPath") as string) || null,
        autoRenew:       fd.get("autoRenew") === "on",
        cardBrand:       kind === "CARD" && cardBrand.trim() ? cardBrand.trim().slice(0, 50) : null,
        cardLast4:       kind === "CARD" && cardLast4.trim() ? cardLast4.trim() : null,
        extraReminders,
      })
      if ("error" in result) { setError(result.error); toast.error("Failed to save changes") }
      else { toast.success("Changes saved"); onSuccess(); onClose() }
    })
  }

  const kindCfg = kindConfig(kind)

  return (
    <Modal title={`Edit: ${sub.vendor.name} — ${sub.planName}`} onClose={onClose} size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}

        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2 space-y-1.5">
            <label className="text-sm font-medium text-foreground">Type <span className="text-destructive">*</span></label>
            <select
              value={kind}
              onChange={e => {
                const next = e.target.value as SubscriptionKind
                setKind(next)
                if (next === "CARD") { setBillingCycle("ONE_TIME"); recalcRenewal(startDate, "ONE_TIME", customDays) }
                else if (kind === "CARD") { setBillingCycle("MONTHLY"); recalcRenewal(startDate, "MONTHLY", customDays) }
              }}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {KIND_OPTIONS.map(k => <option key={k.value} value={k.value}>{k.label}</option>)}
            </select>
          </div>

          <div className="col-span-2 space-y-1.5">
            <label className="text-sm font-medium text-foreground">{kindCfg.planLabel} <span className="text-destructive">*</span></label>
            <Input name="planName" defaultValue={sub.planName} required />
          </div>

          {kind === "CARD" && (
            <>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">Card Brand</label>
                <Input value={cardBrand} onChange={e => setCardBrand(e.target.value)} placeholder="VISA / Mastercard / AMEX" maxLength={50} />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">Last 4 digits</label>
                <Input value={cardLast4} onChange={e => setCardLast4(e.target.value.replace(/\D/g, "").slice(0, 4))} inputMode="numeric" maxLength={4} placeholder="4242" />
              </div>
              <p className="col-span-2 -mt-2 text-xs text-muted-foreground">
                Renewal date below = card expiry. Never enter the full card number or CVV.
              </p>
            </>
          )}

          <div className="col-span-2 space-y-1.5">
            <label className="text-sm font-medium text-foreground">{kindCfg.vendorLabel}</label>
            <div className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">{sub.vendor.name}</div>
          </div>

          <div className="col-span-2 space-y-1.5">
            <label className="text-sm font-medium text-foreground">Department</label>
            <select name="department" defaultValue={(sub as any).department ?? ""} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring">
              <option value="">— None —</option>
              {DEPARTMENTS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">{kind === "CARD" ? "Annual Fee (USD)" : "Cost (USD)"}</label>
            <Input name="cost" type="number" min="0" step="0.01" defaultValue={(sub.cost / 100).toFixed(2)} />
          </div>

          {!kindCfg.hideBillingCycle && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Billing Cycle</label>
              <select
                name="billingCycle"
                value={billingCycle}
                onChange={e => { setBillingCycle(e.target.value); recalcRenewal(startDate, e.target.value, customDays) }}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {Object.entries(cycleLabel).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
          )}
          {kindCfg.hideBillingCycle && <input type="hidden" name="billingCycle" value={billingCycle} />}

          {!kindCfg.hideBillingCycle && billingCycle === "CUSTOM" && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Custom Duration (days)</label>
              <Input name="customDays" type="number" min="1" value={customDays} onChange={e => { setCustomDays(e.target.value); recalcRenewal(startDate, billingCycle, e.target.value) }} placeholder="e.g. 90" />
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Start Date <span className="text-destructive">*</span></label>
            <Input name="startDate" type="date" value={startDate} onChange={e => { setStartDate(e.target.value); recalcRenewal(e.target.value, billingCycle, customDays) }} required />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">
              {kind === "CARD" ? "Card Expiry" : "Renewal Date"} <span className="text-destructive">*</span>
              {billingCycle !== "ONE_TIME" && <span className="ml-1.5 text-xs font-normal text-muted-foreground">(auto)</span>}
            </label>
            <Input name="renewalDate" type="date" value={renewalDate} onChange={e => setRenewalDate(e.target.value)} required />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Status</label>
            <select name="status" defaultValue={sub.status} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring">
              {ALL_STATUSES.map(s => <option key={s} value={s}>{statusConfig[s]?.label ?? s}</option>)}
            </select>
          </div>

          <div className="col-span-2 space-y-1.5">
            <label className="text-sm font-medium text-foreground">Responsible Person</label>
            <Combobox
              name="responsibleId"
              defaultValue={sub.responsible?.id ?? ""}
              options={users.map(u => ({ value: u.id, label: u.name || u.email, searchText: u.email }))}
              placeholder="Unassigned"
              searchPlaceholder="Search users…"
              emptyMessage="No users match."
            />
          </div>

          {!kindCfg.hidePaymentMethod && (
            <div className="col-span-2 space-y-1.5">
              <label className="text-sm font-medium text-foreground">Payment Method</label>
              <Combobox
                name="paymentMethodId"
                defaultValue={sub.paymentMethodId ?? ""}
                options={paymentMethods.map(pm => ({ value: pm.id, label: formatPaymentMethod(pm) }))}
                placeholder="— None —"
                searchPlaceholder={onCreatePaymentMethod ? "Search or type a new payment method…" : "Search payment methods…"}
                emptyMessage="No payment methods match."
                onCreate={onCreatePaymentMethod}
                createLabel={q => `Create "${q}"`}
              />
            </div>
          )}

          <div className="col-span-2 space-y-1.5">
            <label className="text-sm font-medium text-foreground">Document Location</label>
            <Input name="documentPath" defaultValue={sub.documentPath ?? ""} placeholder="e.g. https://nextcloud.krawma.com/IT/contracts/adobe.pdf or IT/contracts/adobe.pdf" />
            <p className="text-xs text-muted-foreground">URL or path to the contract/document in Nextcloud or other storage.</p>
          </div>

          <div className="col-span-2 space-y-1.5">
            <label className="text-sm font-medium text-foreground">Notes</label>
            <textarea name="notes" rows={2} defaultValue={sub.notes ?? ""} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none" placeholder="Optional notes…" />
          </div>

          <div className="col-span-2 flex items-start gap-2">
            <input id="autoRenew-edit" name="autoRenew" type="checkbox" defaultChecked={sub.autoRenew} className="mt-0.5 size-4 rounded border-border" />
            <label htmlFor="autoRenew-edit" className="text-sm text-foreground">
              {kindCfg.autoRenewLabel}
              <span className="block text-xs text-muted-foreground">{kindCfg.autoRenewHint}</span>
            </label>
          </div>

          <ReminderChips
            cycle={billingCycle}
            customDays={customDays}
            renewalDateStr={renewalDate}
            selected={extraReminders}
            setSelected={setExtraReminders}
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>Cancel</Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? <><RiLoader4Line className="size-4 animate-spin" data-icon="inline-start" />Saving…</> : "Save Changes"}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

// ─── Details Modal ────────────────────────────────────────────────────────────

function DetailsModal({ sub, onClose }: { sub: SubscriptionFull; onClose: () => void }) {
  const status     = statusConfig[sub.status]
  const StatusIcon = status?.icon ?? RiCheckLine
  const dept       = deptLabel((sub as SubscriptionFull & { department?: string | null }).department)

  const cardLine = sub.kind === "CARD" && (sub.cardBrand || sub.cardLast4)
    ? [sub.cardBrand?.toUpperCase(), sub.cardLast4 ? `•••• ${sub.cardLast4}` : ""].filter(Boolean).join(" ")
    : null

  const rows: { label: string; value: React.ReactNode }[] = [
    {
      label: "Status",
      value: (
        <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ${status?.className}`}>
          <StatusIcon className="size-3" />
          {status?.label}
        </span>
      ),
    },
    { label: "Type",          value: kindConfig(sub.kind).label },
    ...(cardLine ? [{ label: "Card",  value: cardLine }] : []),
    { label: "Department",    value: dept ?? "—" },
    { label: "Cost",          value: fmt(sub.cost) },
    { label: sub.kind === "CARD" ? "Card Expiry" : "Renewal Date", value: fmtDate(sub.renewalDate) },
    { label: "Auto-renew",    value: sub.autoRenew ? "Yes" : "No" },
    { label: "Responsible",   value: sub.responsible?.name ?? sub.responsible?.email ?? "—" },
    {
      label: "Payment",
      value: sub.paymentMethod
        ? (
          <span className="inline-flex items-center gap-1.5">
            <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              {PAYMENT_METHOD_TYPE_LABELS[sub.paymentMethod.type] ?? sub.paymentMethod.type}
            </span>
            {formatPaymentMethod(sub.paymentMethod)}
          </span>
        )
        : "—",
    },
    { label: "Notes",         value: sub.notes ?? "—" },
  ]

  return (
    <Modal title={`${sub.vendor.name} — ${sub.planName}`} onClose={onClose}>
      <div className="space-y-4">
        <dl className="rounded-lg border border-border overflow-hidden">
          {rows.map((row, i) => (
            <div
              key={row.label}
              className={`grid grid-cols-[120px_1fr] gap-3 px-4 py-2.5 text-sm ${i !== rows.length - 1 ? "border-b border-border" : ""}`}
            >
              <dt className="text-muted-foreground">{row.label}</dt>
              <dd className="text-foreground break-words">{row.value}</dd>
            </div>
          ))}
        </dl>
        <div className="flex justify-end">
          <Button variant="outline" onClick={onClose}>Close</Button>
        </div>
      </div>
    </Modal>
  )
}

// ─── History Modal ────────────────────────────────────────────────────────────

type HistoryEntry = {
  id: string
  previousDate: string
  newDate: string
  createdAt: string
  renewedBy: { name: string | null; email: string }
}

function HistoryModal({ sub, onClose }: { sub: SubscriptionFull; onClose: () => void }) {
  const [logs, setLogs]       = useState<HistoryEntry[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fetch(`/api/subscriptions/${sub.id}/history`)
      .then(async r => {
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Failed to load history")
        return r.json()
      })
      .then((data: HistoryEntry[]) => { if (!cancelled) setLogs(data) })
      .catch(e => { if (!cancelled) setError(e.message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [sub.id])

  return (
    <Modal title={`Renewal history — ${sub.vendor.name} · ${sub.planName}`} onClose={onClose} size="lg">
      <div className="space-y-4">
        {loading && (
          <div className="py-12 text-center text-muted-foreground">
            <RiLoader4Line className="size-5 animate-spin inline" />
          </div>
        )}
        {error && <div className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}
        {!loading && !error && logs && logs.length === 0 && (
          <div className="py-10 text-center">
            <RiHistoryLine className="mx-auto size-10 text-muted-foreground/40" />
            <p className="mt-3 text-sm text-muted-foreground">No renewals recorded yet.</p>
            <p className="text-xs text-muted-foreground mt-1">Logs appear here when this subscription is marked as renewed.</p>
          </div>
        )}
        {!loading && !error && logs && logs.length > 0 && (
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Previous</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">New</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Renewed by</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">When</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {logs.map(log => (
                  <tr key={log.id}>
                    <td className="px-3 py-2 text-muted-foreground">{fmtDate(log.previousDate)}</td>
                    <td className="px-3 py-2 text-foreground">{fmtDate(log.newDate)}</td>
                    <td className="px-3 py-2 text-foreground truncate">{log.renewedBy.name || log.renewedBy.email}</td>
                    <td className="px-3 py-2 text-muted-foreground">{fmtDate(log.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!loading && !error && logs && (
          <p className="text-xs text-muted-foreground">
            Auto-renewals are not shown — only manual &quot;Mark as Renewed&quot; actions are logged.
          </p>
        )}
        <div className="flex justify-end pt-1">
          <Button variant="outline" onClick={onClose}>Close</Button>
        </div>
      </div>
    </Modal>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function SubscriptionsClient({
  subscriptions,
  vendors,
  users,
  paymentMethods: initialPaymentMethods,
  canEdit,
  canAdd,
  canDelete,
  canViewHistory,
  canMarkRenewed,
  canCreatePaymentMethod,
}: {
  subscriptions: SubscriptionFull[]
  vendors: Vendor[]
  users: Pick<User, "id" | "name" | "email">[]
  paymentMethods: PaymentMethod[]
  canEdit: boolean
  canAdd: boolean
  canDelete: boolean
  canViewHistory: boolean
  canMarkRenewed: boolean
  canCreatePaymentMethod: boolean
}) {
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>(initialPaymentMethods)
  const router = useRouter()
  const [search, setSearch]               = useState("")
  const [renewalFilter, setRenewalFilter] = useState<RenewalFilter>("ALL")
  const [deptFilter, setDeptFilter]       = useState("ALL")
  const [sortKey, setSortKey]             = useState<"vendor" | "renewal">("renewal")
  const [sortDir, setSortDir]             = useState<"asc" | "desc">("asc")
  const [showModal, setShowModal]         = useState(false)
  const [editing, setEditing]             = useState<SubscriptionFull | null>(null)
  const [deleting, setDeleting]           = useState<SubscriptionFull | null>(null)
  const [deleteError, setDeleteError]     = useState<string | null>(null)
  const [renewing, setRenewing]           = useState<string | null>(null)
  const [historyFor, setHistoryFor]       = useState<SubscriptionFull | null>(null)
  const [viewing, setViewing]             = useState<SubscriptionFull | null>(null)
  const [page, setPage]                   = useState(1)
  const pageSize                          = 10
  const [, startTransition]               = useTransition()

  // Always shown — View details is available to anyone who can see the table
  const showActionsCol = true

  const onCreatePaymentMethod: PaymentMethodCreator | undefined = canCreatePaymentMethod
    ? async (name: string) => {
        const res = await fetch("/api/payment-methods", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name }),
        })
        if (!res.ok) {
          const j = await res.json().catch(() => ({}))
          toast.error(j.error ?? "Failed to create payment method")
          return null
        }
        const pm: PaymentMethod = await res.json()
        setPaymentMethods(prev => {
          if (prev.some(p => p.id === pm.id)) return prev
          return [...prev, pm].sort((a, b) => a.name.localeCompare(b.name))
        })
        toast.success(`Payment method "${pm.name}" added`)
        return pm.id
      }
    : undefined

  const toggleSort = (key: typeof sortKey) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc")
    else { setSortKey(key); setSortDir("asc") }
  }

  const usedDepts = new Set(subscriptions.map(s => (s as any).department).filter(Boolean))
  const activeDepts = DEPARTMENTS.filter(d => usedDepts.has(d.value))

  const filtered = subscriptions
    .filter(s => matchesRenewalFilter(s, renewalFilter))
    .filter(s => deptFilter === "ALL" || (s as any).department === deptFilter)
    .filter(s => {
      if (!search) return true
      const q = search.toLowerCase()
      const dLabel = deptLabel((s as any).department) ?? ""
      return s.vendor.name.toLowerCase().includes(q) || s.planName.toLowerCase().includes(q) || dLabel.toLowerCase().includes(q)
    })
    .sort((a, b) => {
      let cmp = 0
      if (sortKey === "vendor")  cmp = a.vendor.name.localeCompare(b.vendor.name)
      if (sortKey === "renewal") cmp = new Date(a.renewalDate).getTime() - new Date(b.renewalDate).getTime()
      return sortDir === "asc" ? cmp : -cmp
    })

  const filterKey = `${search}|${renewalFilter}|${deptFilter}|${sortKey}|${sortDir}`
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey)
  if (prevFilterKey !== filterKey) {
    setPrevFilterKey(filterKey)
    setPage(1)
  }
  const totalPages  = Math.max(1, Math.ceil(filtered.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const rangeStart  = filtered.length === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const rangeEnd    = Math.min(currentPage * pageSize, filtered.length)
  const paged       = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  const sortIcon = (col: typeof sortKey) =>
    sortKey === col
      ? sortDir === "asc" ? <RiArrowUpLine className="size-3.5 ml-1 inline" /> : <RiArrowDownLine className="size-3.5 ml-1 inline" />
      : null

  function handleDelete(id: string) {
    startTransition(async () => {
      const result = await deleteSubscription(id)
      if ("error" in result) { setDeleteError(result.error); toast.error("Failed to delete subscription") }
      else { toast.success("Subscription deleted"); setDeleting(null); setDeleteError(null); router.refresh() }
    })
  }

  async function handleMarkRenewed(id: string) {
    setRenewing(id)
    const result = await markAsRenewed(id)
    setRenewing(null)
    if ("error" in result) toast.error(result.error || "Failed to mark as renewed")
    else { toast.success("Marked as renewed"); router.refresh() }
  }

  return (
    <>
      {showModal && (
        <AddSubscriptionModal
          vendors={vendors}
          users={users}
          paymentMethods={paymentMethods}
          onCreatePaymentMethod={onCreatePaymentMethod}
          onClose={() => setShowModal(false)}
          onSuccess={() => router.refresh()}
        />
      )}

      {editing && (
        <EditSubscriptionModal
          sub={editing}
          users={users}
          paymentMethods={paymentMethods}
          onCreatePaymentMethod={onCreatePaymentMethod}
          onClose={() => setEditing(null)}
          onSuccess={() => router.refresh()}
        />
      )}

      {viewing && (
        <DetailsModal sub={viewing} onClose={() => setViewing(null)} />
      )}

      {historyFor && (
        <HistoryModal sub={historyFor} onClose={() => setHistoryFor(null)} />
      )}

      {deleting && (
        <Modal title="Delete Subscription" onClose={() => { setDeleting(null); setDeleteError(null) }}>
          <div className="space-y-4">
            {deleteError && <div className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{deleteError}</div>}
            <p className="text-sm text-muted-foreground">
              Delete <strong className="text-foreground">{deleting.vendor.name} — {deleting.planName}</strong>? This cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setDeleting(null); setDeleteError(null) }}>Cancel</Button>
              <Button variant="destructive" onClick={() => handleDelete(deleting.id)}>Delete</Button>
            </div>
          </div>
        </Modal>
      )}

      <div className="p-4 md:p-6 lg:p-8 space-y-4 md:space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-xl md:text-2xl font-semibold text-foreground tracking-tight">Renewals</h1>
            <p className="mt-1 text-sm text-muted-foreground">Subscriptions, memberships, cards, leases, licenses & contracts.</p>
          </div>
          {canAdd && (
            <Button size="sm" onClick={() => setShowModal(true)} className="self-start sm:self-auto">
              <RiAddLine data-icon="inline-start" />New Renewal
            </Button>
          )}
        </div>

        {/* Table card */}
        <div className="rounded-xl border border-border bg-card">
          {/* Toolbar */}
          <div className="flex flex-col gap-3 px-4 py-3 md:px-6 md:py-4 border-b border-border">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative w-full sm:max-w-xs">
                <RiSearchLine className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search vendor, plan, or department…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <RiFilterLine className="size-4 text-muted-foreground shrink-0" />
                <span className="text-xs text-muted-foreground shrink-0">Upcoming renewal:</span>
                {RENEWAL_FILTERS.map(f => (
                  <button
                    key={f.value}
                    onClick={() => setRenewalFilter(f.value)}
                    className={`cursor-pointer rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                      renewalFilter === f.value ? "bg-primary text-white" : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
            {activeDepts.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-muted-foreground shrink-0">Department:</span>
                <button
                  onClick={() => setDeptFilter("ALL")}
                  className={`cursor-pointer rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                    deptFilter === "ALL" ? "bg-primary text-white" : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  All
                </button>
                {activeDepts.map(d => (
                  <button
                    key={d.value}
                    onClick={() => setDeptFilter(d.value)}
                    className={`cursor-pointer rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                      deptFilter === d.value ? "bg-primary text-white" : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Table (md+) */}
          <div className="hidden md:block">
            <table className="w-full text-sm table-fixed">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-4 xl:px-6 py-3 text-left font-medium text-muted-foreground">Type</th>
                  <th className="px-4 xl:px-6 py-3 text-left font-medium text-muted-foreground">Plan</th>
                  <th className="cursor-pointer select-none px-4 xl:px-6 py-3 text-left font-medium text-muted-foreground hover:text-foreground transition-colors" onClick={() => toggleSort("vendor")}>
                    Vendor {sortIcon("vendor")}
                  </th>
                  <th className="px-4 xl:px-6 py-3 text-left font-medium text-muted-foreground">Cycle</th>
                  <th className="cursor-pointer select-none px-4 xl:px-6 py-3 text-left font-medium text-muted-foreground hover:text-foreground transition-colors" onClick={() => toggleSort("renewal")}>
                    Renewal {sortIcon("renewal")}
                  </th>
                  {showActionsCol && <th className="px-4 xl:px-6 py-3 text-right font-medium text-muted-foreground">Action</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={showActionsCol ? 6 : 5} className="px-6 py-16 text-center text-sm text-muted-foreground">
                      {subscriptions.length === 0
                        ? "No renewals yet. Click \"New Renewal\" to create one."
                        : "No subscriptions match your search."}
                    </td>
                  </tr>
                ) : paged.map(sub => {
                  const days      = daysUntil(sub.renewalDate)
                  const isUrgent  = days <= 7 && days >= 0 && sub.status === "ACTIVE"
                  const cardTail  = sub.kind === "CARD" && (sub.cardBrand || sub.cardLast4)
                    ? [sub.cardBrand?.toUpperCase(), sub.cardLast4 ? `•••• ${sub.cardLast4}` : ""].filter(Boolean).join(" ")
                    : null

                  return (
                    <tr key={sub.id} className="hover:bg-muted/40 transition-colors">
                      <td className="px-4 xl:px-6 py-3.5">
                        <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground whitespace-nowrap">
                          {kindConfig(sub.kind).label}
                        </span>
                      </td>
                      <td className="px-4 xl:px-6 py-3.5">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="font-medium text-foreground truncate">{sub.planName}</span>
                          {cardTail && (
                            <span className="shrink-0 text-xs text-muted-foreground">— {cardTail}</span>
                          )}
                          {sub.documentPath && (
                            sub.documentPath.startsWith("http")
                              ? <a href={sub.documentPath} target="_blank" rel="noreferrer" title="View document" className="shrink-0 text-primary hover:text-primary/80"><RiLink className="size-3.5" /></a>
                              : <span title={sub.documentPath} className="shrink-0 text-muted-foreground/70">
                                  <RiLink className="size-3.5" />
                                </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 xl:px-6 py-3.5 text-muted-foreground truncate">
                        <span className="inline-flex items-center gap-1.5">
                          {sub.vendor.name}
                          {sub.autoRenew && (
                            <span className="inline-flex items-center rounded-md bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-medium text-blue-600 dark:text-blue-400">Auto</span>
                          )}
                        </span>
                      </td>
                      <td className="px-4 xl:px-6 py-3.5 text-muted-foreground">
                        {cycleLabel[sub.billingCycle] ?? sub.billingCycle}
                        {sub.billingCycle === "CUSTOM" && sub.customDays ? ` (${sub.customDays}d)` : ""}
                      </td>
                      <td className="px-4 xl:px-6 py-3.5">
                        <span className={isUrgent ? "text-amber-600 dark:text-amber-400 font-medium" : "text-muted-foreground"}>
                          {fmtDate(sub.renewalDate)}
                        </span>
                        {isUrgent && (
                          <span className="ml-1.5 inline-flex items-center rounded-md bg-amber-500/10 px-1.5 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                            {days}d
                          </span>
                        )}
                      </td>
                      {showActionsCol && (
                        <td className="px-4 xl:px-6 py-3.5">
                          <div className="flex items-center justify-end gap-2">
                            {canMarkRenewed && sub.status !== "CANCELLED" && daysUntil(sub.renewalDate) <= 30 && (
                              <Button
                                variant="outline"
                                size="icon-sm"
                                title="Mark as Renewed"
                                className="text-emerald-600 hover:text-emerald-600"
                                disabled={renewing === sub.id}
                                onClick={() => handleMarkRenewed(sub.id)}
                              >
                                {renewing === sub.id
                                  ? <RiLoader4Line className="size-4 animate-spin" />
                                  : <RiCheckDoubleLine className="size-4" />}
                              </Button>
                            )}
                            <Button variant="outline" size="icon-sm" title="View details" onClick={() => setViewing(sub)}>
                              <RiEyeLine className="size-4" />
                            </Button>
                            {canViewHistory && (
                              <Button variant="outline" size="icon-sm" title="View renewal history" onClick={() => setHistoryFor(sub)}>
                                <RiHistoryLine className="size-4" />
                              </Button>
                            )}
                            {canEdit && (
                              <Button variant="outline" size="icon-sm" title="Edit" onClick={() => setEditing(sub)}>
                                <RiEditLine className="size-4" />
                              </Button>
                            )}
                            {canDelete && (
                              <Button variant="outline" size="icon-sm" title="Delete" className="text-destructive hover:text-destructive" onClick={() => { setDeleting(sub); setDeleteError(null) }}>
                                <RiDeleteBinLine className="size-4" />
                              </Button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Card list (mobile) */}
          <div className="md:hidden divide-y divide-border">
            {filtered.length === 0 ? (
              <div className="px-4 py-12 text-center text-sm text-muted-foreground">
                {subscriptions.length === 0
                  ? "No renewals yet. Click \"New Renewal\" to create one."
                  : "No subscriptions match your search."}
              </div>
            ) : paged.map(sub => {
              const days      = daysUntil(sub.renewalDate)
              const isUrgent  = days <= 7 && days >= 0 && sub.status === "ACTIVE"
              const cardTail  = sub.kind === "CARD" && (sub.cardBrand || sub.cardLast4)
                ? [sub.cardBrand?.toUpperCase(), sub.cardLast4 ? `•••• ${sub.cardLast4}` : ""].filter(Boolean).join(" ")
                : null

              return (
                <div key={sub.id} className="px-4 py-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground whitespace-nowrap">
                          {kindConfig(sub.kind).label}
                        </span>
                      </div>
                      <div className="font-medium text-foreground truncate flex items-center gap-1.5">
                        {sub.vendor.name}
                        {sub.autoRenew && (
                          <span className="inline-flex items-center rounded-md bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-medium text-blue-600 dark:text-blue-400 shrink-0">Auto</span>
                        )}
                        {sub.documentPath && (
                          sub.documentPath.startsWith("http")
                            ? <a href={sub.documentPath} target="_blank" rel="noreferrer" title="View document" className="shrink-0 text-primary hover:text-primary/80"><RiLink className="size-3.5" /></a>
                            : <span title={sub.documentPath} className="shrink-0 text-muted-foreground/70"><RiLink className="size-3.5" /></span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {sub.planName}{cardTail ? ` — ${cardTail}` : ""}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                    <div>
                      <div className="text-muted-foreground">Cycle</div>
                      <div className="text-foreground">
                        {cycleLabel[sub.billingCycle] ?? sub.billingCycle}
                        {sub.billingCycle === "CUSTOM" && sub.customDays ? ` (${sub.customDays}d)` : ""}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Renewal</div>
                      <div className={isUrgent ? "text-amber-600 dark:text-amber-400 font-medium" : "text-foreground"}>
                        {fmtDate(sub.renewalDate)}
                        {isUrgent && (
                          <span className="ml-1.5 inline-flex items-center rounded-md bg-amber-500/10 px-1.5 py-0.5 font-medium text-amber-600 dark:text-amber-400">
                            {days}d
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {showActionsCol && (
                    <div className="flex items-center gap-2 pt-1">
                      {canMarkRenewed && sub.status !== "CANCELLED" && daysUntil(sub.renewalDate) <= 30 && (
                        <Button
                          variant="outline"
                          size="icon-sm"
                          title="Mark as Renewed"
                          className="text-emerald-600 hover:text-emerald-600"
                          disabled={renewing === sub.id}
                          onClick={() => handleMarkRenewed(sub.id)}
                        >
                          {renewing === sub.id
                            ? <RiLoader4Line className="size-4 animate-spin" />
                            : <RiCheckDoubleLine className="size-4" />}
                        </Button>
                      )}
                      <Button variant="outline" size="icon-sm" title="View details" onClick={() => setViewing(sub)}>
                        <RiEyeLine className="size-4" />
                      </Button>
                      {canViewHistory && (
                        <Button variant="outline" size="icon-sm" title="View renewal history" onClick={() => setHistoryFor(sub)}>
                          <RiHistoryLine className="size-4" />
                        </Button>
                      )}
                      {canEdit && (
                        <Button variant="outline" size="icon-sm" title="Edit" onClick={() => setEditing(sub)}>
                          <RiEditLine className="size-4" />
                        </Button>
                      )}
                      {canDelete && (
                        <Button variant="outline" size="icon-sm" title="Delete" className="text-destructive hover:text-destructive" onClick={() => { setDeleting(sub); setDeleteError(null) }}>
                          <RiDeleteBinLine className="size-4" />
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Footer */}
          <div className="px-4 py-3 md:px-6 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {filtered.length === 0
                ? `0 of ${subscriptions.length}`
                : `Showing ${rangeStart}–${rangeEnd} of ${filtered.length}`}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage <= 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <span className="px-1">Page {currentPage} of {totalPages}</span>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage >= totalPages}
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              >
                Next
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
