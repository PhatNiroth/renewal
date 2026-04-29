import { db } from "@/lib/db"
import { auth } from "@/lib/auth"
import { NextResponse } from "next/server"
import { PaymentMethodType } from "@prisma/client"

const VALID_TYPES = Object.values(PaymentMethodType)

function sanitizeLast4(input: unknown): string | null {
  if (typeof input !== "string") return null
  const trimmed = input.trim()
  if (!trimmed) return null
  if (!/^\d{4}$/.test(trimmed)) return null
  return trimmed
}

function sanitizeStr(input: unknown, max = 200): string | null {
  if (typeof input !== "string") return null
  const trimmed = input.trim()
  if (!trimmed) return null
  return trimmed.slice(0, max)
}

export async function GET() {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const methods = await db.paymentMethod.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
  })
  return NextResponse.json(methods)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const name = sanitizeStr(body.name, 100)
  const type = (body.type ?? PaymentMethodType.OTHER) as PaymentMethodType

  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 })
  if (!VALID_TYPES.includes(type)) {
    return NextResponse.json({ error: "Invalid payment method type" }, { status: 400 })
  }

  // Reject any input that looks like a full card number anywhere — defense in depth
  // against accidentally pasting a PAN into a free-text field.
  const allInputs = [body.cardLast4, body.accountLast4, body.reference, body.notes, body.cardExpiry, body.bankName, body.cardBrand, name]
  for (const v of allInputs) {
    if (typeof v === "string" && /\b\d{12,19}\b/.test(v.replace(/[\s-]/g, ""))) {
      return NextResponse.json({ error: "Looks like a full card number — only the last 4 digits are allowed" }, { status: 400 })
    }
  }

  // Idempotent inline create: if a payment method with this name (case-insensitive)
  // already exists, return it instead of erroring.
  const existing = await db.paymentMethod.findFirst({
    where: { isActive: true, name: { equals: name, mode: "insensitive" } },
  })
  if (existing) return NextResponse.json(existing)

  try {
    const created = await db.paymentMethod.create({
      data: {
        name,
        type,
        cardBrand:    type === "CARD" ? sanitizeStr(body.cardBrand, 50) : null,
        cardLast4:    type === "CARD" ? sanitizeLast4(body.cardLast4) : null,
        cardExpiry:   type === "CARD" ? sanitizeStr(body.cardExpiry, 7) : null,
        bankName:     type === "BANK_TRANSFER" ? sanitizeStr(body.bankName, 100) : null,
        accountLast4: type === "BANK_TRANSFER" ? sanitizeLast4(body.accountLast4) : null,
        reference:    sanitizeStr(body.reference, 200),
        notes:        sanitizeStr(body.notes, 500),
      },
    })
    return NextResponse.json(created, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
