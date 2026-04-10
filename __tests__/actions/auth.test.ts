import { describe, it, expect, vi, beforeEach } from "vitest"
import { db } from "@/lib/db"
import bcrypt from "bcryptjs"

vi.mock("@/lib/db", () => ({
  db: {
    user: {
      findUnique: vi.fn(),
      create:     vi.fn(),
    },
  },
}))

vi.mock("bcryptjs", () => ({
  default: {
    hash:    vi.fn().mockResolvedValue("hashed_password"),
    compare: vi.fn(),
  },
}))

vi.mock("@/lib/auth", () => ({
  auth:    vi.fn(),
  signOut: vi.fn(),
}))

const mockDb = vi.mocked(db)
const { signup } = await import("@/app/actions/auth")

describe("signup", () => {
  beforeEach(() => vi.clearAllMocks())

  it("returns error if email is missing", async () => {
    const fd = new FormData()
    fd.set("password", "password123")
    const result = await signup(fd)
    expect(result).toEqual({ error: "Email and password are required" })
  })

  it("returns error if password is missing", async () => {
    const fd = new FormData()
    fd.set("email", "user@test.com")
    const result = await signup(fd)
    expect(result).toEqual({ error: "Email and password are required" })
  })

  it("returns error if password is too short", async () => {
    const fd = new FormData()
    fd.set("email", "user@test.com")
    fd.set("password", "short")
    const result = await signup(fd)
    expect(result).toEqual({ error: "Password must be at least 8 characters" })
  })

  it("returns error if email already exists", async () => {
    vi.mocked(mockDb.user.findUnique).mockResolvedValueOnce({ id: "existing" } as any)
    const fd = new FormData()
    fd.set("email", "existing@test.com")
    fd.set("password", "password123")
    const result = await signup(fd)
    expect(result).toEqual({ error: "An account with this email already exists" })
  })

  it("creates user successfully", async () => {
    vi.mocked(mockDb.user.findUnique).mockResolvedValueOnce(null)
    vi.mocked(mockDb.user.create).mockResolvedValueOnce({} as any)
    const fd = new FormData()
    fd.set("name", "John")
    fd.set("email", "john@test.com")
    fd.set("password", "password123")
    const result = await signup(fd)
    expect(result).toEqual({ success: true })
    expect(mockDb.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email:    "john@test.com",
          name:     "John",
          password: "hashed_password",
        }),
      })
    )
  })

  it("hashes password with cost 12", async () => {
    vi.mocked(mockDb.user.findUnique).mockResolvedValueOnce(null)
    vi.mocked(mockDb.user.create).mockResolvedValueOnce({} as any)
    const fd = new FormData()
    fd.set("email", "user@test.com")
    fd.set("password", "mypassword")
    await signup(fd)
    expect(bcrypt.hash).toHaveBeenCalledWith("mypassword", 12)
  })
})
