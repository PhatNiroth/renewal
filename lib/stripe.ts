import Stripe from "stripe"

const globalForStripe = globalThis as unknown as { stripe: Stripe | undefined }

export function getStripe() {
  if (!globalForStripe.stripe) {
    globalForStripe.stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: "2024-12-18.acacia" as any,
    })
  }
  return globalForStripe.stripe
}

