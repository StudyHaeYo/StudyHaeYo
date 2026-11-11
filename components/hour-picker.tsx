"use client"

import { useEffect, useId, useRef, useState, type ReactNode } from "react"

const PICK_HOURS = Array.from({ length: 18 }, (_, i) => i + 6) // 6시 ~ 23시

// 몇 시에 할지 (오늘 시간표, D-38): a button that opens the hours as chips. The panel hangs from the nearest positioned
// ancestor (the row), right-aligned. Picking the hour already set, or 시각 지우기, gives null.
export function HourPicker({
  hour,
  onPick,
  label,
  className,
  children,
}: {
  hour: number | null
  onPick: (hour: number | null) => void
  // What the button does, for screen readers (the visible content may be only an icon or "13시").
  label: string
  className: (open: boolean) => string
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLSpanElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const panelId = useId()

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return
      setOpen(false)
      buttonRef.current?.focus()
    }
    document.addEventListener("mousedown", onDown)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onDown)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  const pick = (h: number | null) => {
    onPick(h === null || h === hour ? null : h)
    setOpen(false)
    buttonRef.current?.focus()
  }

  return (
    <span ref={wrapRef} className="shrink-0">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={label}
        className={className(open)}
      >
        {children}
      </button>
      {open && (
        <div
          id={panelId}
          role="group"
          aria-label="몇 시에 할지"
          className="absolute right-2 top-full z-20 mt-1 w-60 max-w-[calc(100vw-2rem)] rounded-lg border border-border bg-popover p-2 shadow-lg"
        >
          <div className="grid grid-cols-6 gap-1">
            {PICK_HOURS.map((h) => (
              <button
                key={h}
                type="button"
                aria-pressed={h === hour}
                onClick={() => pick(h)}
                className={`h-8 rounded-md text-xs tabular-nums transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-action-500 ${
                  h === hour ? "bg-action-600 font-medium text-action-foreground" : "text-foreground hover:bg-accent"
                }`}
              >
                {h}시
              </button>
            ))}
          </div>
          {hour !== null && (
            <button
              type="button"
              onClick={() => pick(null)}
              className="mt-1.5 w-full rounded-md py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              시각 지우기
            </button>
          )}
        </div>
      )}
    </span>
  )
}
