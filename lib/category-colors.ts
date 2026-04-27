export const CATEGORY_PALETTE = [
  "blue",
  "violet",
  "amber",
  "emerald",
  "rose",
  "orange",
  "cyan",
  "gray",
] as const

export function pickAutoColor(existingCount: number): string {
  return CATEGORY_PALETTE[existingCount % CATEGORY_PALETTE.length]
}
