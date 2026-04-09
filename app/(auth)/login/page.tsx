"use client"

import Link from "next/link"
import { useState } from "react"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type FieldErrors = { email?: string; password?: string }

function validateForm(email: string, password: string): FieldErrors {
  const errs: FieldErrors = {}
  if (!email.trim())                              errs.email = "Email is required"
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = "Enter a valid email address"
  if (!password)                                  errs.password = "Password is required"
  else if (password.length < 6)                   errs.password = "Password must be at least 6 characters"
  return errs
}

export default function LoginPage() {
  const router = useRouter()
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [formError, setFormError]     = useState<string | null>(null)
  const [pending, setPending]         = useState(false)

  function clearFieldError(field: keyof FieldErrors) {
    if (fieldErrors[field]) setFieldErrors(prev => ({ ...prev, [field]: undefined }))
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setFormError(null)

    const formData = new FormData(e.currentTarget)
    const email    = (formData.get("email")    as string).trim()
    const password = formData.get("password") as string

    // Client-side validation
    const errs = validateForm(email, password)
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs)
      return
    }

    setFieldErrors({})
    setPending(true)

    try {
      const res = await (signIn as Function)("credentials", {
        email,
        password,
        redirect: false,
      }) as { ok?: boolean } | undefined

      if (!res?.ok) {
        setFormError("Incorrect email or password. Please try again.")
      } else {
        router.push("/dashboard")
      }
    } catch {
      setFormError("Something went wrong. Please try again.")
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="w-full max-w-sm">
      <div className="rounded-xl border border-border bg-card p-8 shadow-sm">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-foreground">Sign in to RenewTrack</h1>
          <p className="mt-1 text-sm text-muted-foreground">Internal access only — authorised staff</p>
        </div>

        <form onSubmit={handleSubmit} noValidate className="space-y-4">

          {/* Form-level error (wrong credentials) */}
          {formError && (
            <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2.5 text-sm text-destructive">
              {formError}
            </div>
          )}

          {/* Email */}
          <div className="space-y-1.5">
            <label htmlFor="email" className="text-sm font-medium text-foreground">
              Email
            </label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="you@company.com"
              autoComplete="email"
              onChange={() => clearFieldError("email")}
              className={cn(fieldErrors.email && "border-destructive focus-visible:ring-destructive/30")}
            />
            {fieldErrors.email && (
              <p className="text-xs text-destructive">{fieldErrors.email}</p>
            )}
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <label htmlFor="password" className="text-sm font-medium text-foreground">
              Password
            </label>
            <Input
              id="password"
              name="password"
              type="password"
              placeholder="••••••••"
              autoComplete="current-password"
              onChange={() => clearFieldError("password")}
              className={cn(fieldErrors.password && "border-destructive focus-visible:ring-destructive/30")}
            />
            {fieldErrors.password && (
              <p className="text-xs text-destructive">{fieldErrors.password}</p>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Signing in…" : "Sign in"}
          </Button>
        </form>

        <p className="mt-5 text-center text-sm text-muted-foreground">
          Contact your administrator to get access.
        </p>
      </div>
    </div>
  )
}
