import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import Script from "next/script"
import "./globals.css"
import { cn } from "@/lib/utils"
import Providers from "./providers"
import { Toaster } from "react-hot-toast"

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "Krawma Renewal — Internal Subscription Management",
  description: "Internal tool for tracking company subscriptions, vendors, and renewal dates.",
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={cn("h-full antialiased", geistSans.variable, geistMono.variable, "font-sans")} suppressHydrationWarning>
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <Script id="theme-init" strategy="beforeInteractive">
          {`(function(){try{var s=localStorage.getItem('theme');var d=s?s==='dark':window.matchMedia('(prefers-color-scheme:dark)').matches;if(d)document.documentElement.classList.add('dark')}catch(e){}})()`}
        </Script>
        <Providers>{children}</Providers>
        <Toaster position="top-right" toastOptions={{ style: { borderRadius: "8px", fontSize: "14px" } }} />
      </body>
    </html>
  )
}
