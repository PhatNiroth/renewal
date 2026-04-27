import type { PaymentMethod } from "@prisma/client"

export const PAYMENT_METHOD_TYPE_LABELS: Record<string, string> = {
  CARD:          "Card",
  BANK_TRANSFER: "Bank Transfer",
  INVOICE:       "Invoice / NET",
  WIRE:          "Wire Transfer",
  CHECK:         "Check",
  PAYPAL:        "PayPal",
  CASH:          "Cash",
  OTHER:         "Other",
}

/**
 * Render a human-readable label for a payment method, suitable for combobox
 * options and inline references in the UI. Always includes the name; appends
 * type-specific identifiers when available.
 */
export function formatPaymentMethod(pm: Pick<PaymentMethod, "name" | "type" | "cardBrand" | "cardLast4" | "bankName" | "accountLast4" | "reference">): string {
  switch (pm.type) {
    case "CARD": {
      const brand = pm.cardBrand ? pm.cardBrand.toUpperCase() : ""
      const last4 = pm.cardLast4 ? `•••• ${pm.cardLast4}` : ""
      const tail = [brand, last4].filter(Boolean).join(" ")
      return tail ? `${pm.name} — ${tail}` : pm.name
    }
    case "BANK_TRANSFER": {
      const tail = [pm.bankName, pm.accountLast4 ? `•••• ${pm.accountLast4}` : ""].filter(Boolean).join(" ")
      return tail ? `${pm.name} — ${tail}` : pm.name
    }
    case "INVOICE":
    case "WIRE":
    case "CHECK":
    case "OTHER":
    case "PAYPAL":
    case "CASH":
      return pm.reference ? `${pm.name} — ${pm.reference}` : pm.name
    default:
      return pm.name
  }
}
