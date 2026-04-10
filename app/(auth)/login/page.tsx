"use client"

import { useState } from "react"
import { signIn, type SignInResponse } from "next-auth/react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { RiEyeLine, RiEyeOffLine } from "@remixicon/react"

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
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [formError, setFormError]     = useState<string | null>(null)
  const [pending, setPending]         = useState(false)
  const [showPassword, setShowPassword] = useState(false)

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
      const res = await signIn("credentials", {
        email,
        password,
        redirect: false,
      }) as SignInResponse | undefined

      if (res?.error) {
        setFormError("Incorrect email or password. Please try again.")
      } else {
        window.location.href = "/dashboard"
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
            <div className="relative">
              <Input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                autoComplete="current-password"
                onChange={() => clearFieldError("password")}
                className={cn("pr-10", fieldErrors.password && "border-destructive focus-visible:ring-destructive/30")}
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground transition-colors"
                tabIndex={-1}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <RiEyeOffLine className="size-4" /> : <RiEyeLine className="size-4" />}
              </button>
            </div>
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
