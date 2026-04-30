"use client"

import { RiCloseLine } from "@remixicon/react"

interface ModalProps {
  title: string
  onClose: () => void
  children: React.ReactNode
  size?: "sm" | "md" | "lg"
}

const sizeClass = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
}

export function Modal({ title, onClose, children, size = "md" }: ModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/20 backdrop-blur-sm p-4">
      <div
        className={`w-full ${sizeClass[size]} rounded-xl border border-border bg-card shadow-xl max-h-[90vh] overflow-y-auto`}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h3 className="font-semibold text-foreground">{title}</h3>
          <button
            onClick={onClose}
            className="cursor-pointer flex size-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <RiCloseLine className="size-4" />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  )
}
