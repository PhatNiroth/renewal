import { describe, it, expect } from "vitest"
import { can, getPermissions } from "@/lib/permissions"

describe("can()", () => {
  const permissions = {
    SUBSCRIPTIONS: { view: true,  add: true,  edit: false, delete: false },
    RENEWALS:      { view: true,  add: false, edit: true,  delete: false },
    VENDORS:       { view: false, add: false, edit: false, delete: false },
  }

  it("returns true when permission is granted", () => {
    expect(can(permissions, "SUBSCRIPTIONS", "view")).toBe(true)
    expect(can(permissions, "SUBSCRIPTIONS", "add")).toBe(true)
    expect(can(permissions, "RENEWALS", "edit")).toBe(true)
  })

  it("returns false when permission is denied", () => {
    expect(can(permissions, "SUBSCRIPTIONS", "edit")).toBe(false)
    expect(can(permissions, "SUBSCRIPTIONS", "delete")).toBe(false)
    expect(can(permissions, "VENDORS", "view")).toBe(false)
  })

  it("returns false for a module that does not exist", () => {
    expect(can(permissions, "PAYMENTS", "view")).toBe(false)
  })

  it("returns false when permissions is empty", () => {
    expect(can({}, "SUBSCRIPTIONS", "view")).toBe(false)
  })

  it("returns false when permissions is null/undefined", () => {
    expect(can(null as any, "SUBSCRIPTIONS", "view")).toBe(false)
    expect(can(undefined as any, "SUBSCRIPTIONS", "view")).toBe(false)
  })
})

describe("getPermissions()", () => {
  it("returns permissions from session", () => {
    const session = {
      user: {
        permissions: { SUBSCRIPTIONS: { view: true, add: false, edit: false, delete: false } },
      },
    }
    const perms = getPermissions(session)
    expect(perms).toEqual(session.user.permissions)
  })

  it("returns empty object if no permissions on session", () => {
    const session = { user: {} }
    expect(getPermissions(session)).toEqual({})
  })

  it("returns empty object if session is null", () => {
    expect(getPermissions(null)).toEqual({})
  })
})
