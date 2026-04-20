import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import "./globals.css"
import { cn } from "@/lib/utils"
import Providers from "./providers"
import { Toaster } from "react-hot-toast"
import { ThemeInit } from "@/components/theme-init"

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "RenewTrack — Internal Subscription Management",
  description: "Internal tool for tracking company subscriptions, vendors, and renewal dates.",
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={cn("h-full antialiased", geistSans.variable, geistMono.variable, "font-sans")} suppressHydrationWarning>
      <head />
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <ThemeInit />
        <Providers>{children}</Providers>
        <Toaster position="top-right" toastOptions={{ style: { borderRadius: "8px", fontSize: "14px" } }} />
      </body>
    </html>
  )
}
