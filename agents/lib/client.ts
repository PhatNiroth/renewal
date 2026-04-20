import Anthropic from "@anthropic-ai/sdk"

const globalForAnthropic = globalThis as unknown as {
  anthropic: Anthropic | undefined
}

function getAnthropic() {
  if (!globalForAnthropic.anthropic) {
    globalForAnthropic.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    })
  }
  return globalForAnthropic.anthropic
}

/** Lazy-initialized — safe for Vercel build */
export const anthropic = new Proxy({} as Anthropic, {
  get(_target, prop) {
    return (getAnthropic() as any)[prop]
  },
})

export const MODEL = "claude-opus-4-6" as const
