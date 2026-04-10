import { describe, it, expect } from "vitest"
import { cn } from "@/lib/utils"

describe("cn()", () => {
  it("merges class names", () => {
    expect(cn("foo", "bar")).toBe("foo bar")
  })

  it("handles conditional classes", () => {
    expect(cn("base", false && "hidden", "visible")).toBe("base visible")
  })

  it("deduplicates tailwind conflicting classes", () => {
    // twMerge should keep the last one
    expect(cn("p-4", "p-8")).toBe("p-8")
    expect(cn("text-sm", "text-lg")).toBe("text-lg")
  })

  it("handles undefined and null values", () => {
    expect(cn("foo", undefined, null, "bar")).toBe("foo bar")
  })

  it("returns empty string for no input", () => {
    expect(cn()).toBe("")
  })
})
