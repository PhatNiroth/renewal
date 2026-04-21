"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { RiArrowDownSLine, RiCloseLine, RiSearchLine } from "@remixicon/react"

export type ComboboxOption = {
  value: string
  label: string
  /** Extra text to match against in the search filter (e.g. email). */
  searchText?: string
}

type Props = {
  options: ComboboxOption[]
  value?: string
  defaultValue?: string
  onChange?: (value: string) => void
  name?: string
  required?: boolean
  disabled?: boolean
  placeholder?: string
  searchPlaceholder?: string
  emptyMessage?: string
  allowClear?: boolean
  className?: string
}

export function Combobox({
  options,
  value,
  defaultValue,
  onChange,
  name,
  required,
  disabled,
  placeholder = "Select…",
  searchPlaceholder = "Search…",
  emptyMessage = "No matches.",
  allowClear = true,
  className,
}: Props) {
  const isControlled = value !== undefined
  const [internalValue, setInternalValue] = useState(defaultValue ?? "")
  const [isOpen, setIsOpen]               = useState(false)
  const [query, setQuery]                 = useState("")
  const [highlight, setHighlight]         = useState(0)
  const wrapRef  = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const selectedValue = isControlled ? value : internalValue
  const selected      = options.find(o => o.value === selectedValue)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter(o => {
      const hay = `${o.label} ${o.searchText ?? ""}`.toLowerCase()
      return hay.includes(q)
    })
  }, [query, options])

  useEffect(() => {
    if (!isOpen) return
    function onDocClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setIsOpen(false)
        setQuery("")
      }
    }
    document.addEventListener("mousedown", onDocClick)
    return () => document.removeEventListener("mousedown", onDocClick)
  }, [isOpen])

  useEffect(() => {
    if (isOpen) {
      setHighlight(0)
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [isOpen])

  function pick(v: string) {
    if (!isControlled) setInternalValue(v)
    onChange?.(v)
    setIsOpen(false)
    setQuery("")
  }

  function clear(e: React.MouseEvent) {
    e.stopPropagation()
    if (!isControlled) setInternalValue("")
    onChange?.("")
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setHighlight(h => Math.min(h + 1, filtered.length - 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setHighlight(h => Math.max(h - 1, 0))
    } else if (e.key === "Enter") {
      e.preventDefault()
      const v = filtered[highlight]
      if (v) pick(v.value)
    } else if (e.key === "Escape") {
      setIsOpen(false)
      setQuery("")
    }
  }

  return (
    <div ref={wrapRef} className={`relative ${className ?? ""}`}>
      {name && <input type="hidden" name={name} value={selectedValue ?? ""} required={required} />}

      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(o => !o)}
        className="w-full flex items-center justify-between gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span className={selected ? "truncate" : "truncate text-muted-foreground"}>
          {selected?.label ?? placeholder}
        </span>
        <span className="flex items-center gap-1 shrink-0">
          {allowClear && selected && !disabled && (
            <span
              role="button"
              tabIndex={-1}
              onClick={clear}
              className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Clear selection"
            >
              <RiCloseLine className="size-3.5" />
            </span>
          )}
          <RiArrowDownSLine className={`size-4 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
        </span>
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-border bg-background shadow-lg">
          <div className="flex items-center gap-2 border-b border-border px-3 py-2">
            <RiSearchLine className="size-4 text-muted-foreground shrink-0" />
            <input
              ref={inputRef}
              value={query}
              onChange={e => { setQuery(e.target.value); setHighlight(0) }}
              onKeyDown={onKeyDown}
              placeholder={searchPlaceholder}
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
          </div>
          <ul className="max-h-60 overflow-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-sm text-muted-foreground">{emptyMessage}</li>
            ) : filtered.map((o, i) => (
              <li
                key={o.value}
                onMouseEnter={() => setHighlight(i)}
                onClick={() => pick(o.value)}
                className={`cursor-pointer px-3 py-2 text-sm ${
                  i === highlight ? "bg-muted text-foreground" : "text-foreground"
                } ${o.value === selectedValue ? "font-medium" : ""}`}
              >
                {o.label}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
