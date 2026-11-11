"use client"

import { useEffect, useId, useRef, useState, type ReactNode } from "react"

const HOURS = Array.from({ length: 18 }, (_, i) => i + 6) // 6시 ~ 23시
const LENGTHS = [30, 60, 90, 120, 180]
const LENGTH_LABELS: Record<number, string> = { 30: "30분", 60: "1시간", 90: "1시간 반", 120: "2시간", 180: "3시간" }

// 몇 시부터 얼마 동안 (오늘 시간표, D-38): a button that opens the hours as chips, then 정각 / 30분, then the length.
// Every pick is saved at once and the panel stays open, so the start and the length can be set in one visit; it
// closes on a click outside or Esc. `closeOnPick` is for a one-step use (putting a plan on the timetable).
// The panel hangs from the nearest positioned ancestor (the row), right-aligned.
export function TimePicker({
  startMin,
  durationMin,
  onChange,
  withDuration,
  closeOnPick = false,
  label,
  className,
  children,
}: {
  startMin: number | null
  durationMin: number | null
  // null start = no time (the length goes with it).
  onChange: (startMin: number | null, durationMin: number | null) => void
  // Offer the length (the duration_min column exists).
  withDuration: boolean
  closeOnPick?: boolean
  // What the button does, for screen readers (the visible content may be only an icon or "13:30").
  label: string
  className: (open: boolean) => string
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLSpanElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const panelId = useId()
  const hour = startMin === null ? null : Math.floor(startMin / 60)
  const half = startMin !== null && startMin % 60 >= 30

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

  const change = (start: number | null, length: number | null) => {
    onChange(start, start === null ? null : length)
    if (closeOnPick || start === null) {
      setOpen(false)
      buttonRef.current?.focus()
    }
  }

  const chip = (selected: boolean) =>
    `h-8 rounded-md text-xs tabular-nums transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-action-500 disabled:opacity-40 ${
      selected ? "bg-action-600 font-medium text-action-foreground" : "text-foreground hover:bg-accent"
    }`
  const caption = "mb-1 mt-2 px-0.5 text-[11px] text-muted-foreground first:mt-0"

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
          aria-label="몇 시부터 얼마 동안"
          className="absolute right-2 top-full z-20 mt-1 w-64 max-w-[calc(100vw-2rem)] rounded-lg border border-border bg-popover p-2 shadow-lg"
        >
          <p className={caption}>시작</p>
          <div className="grid grid-cols-6 gap-1">
            {HOURS.map((h) => (
              <button key={h} type="button" aria-pressed={h === hour} onClick={() => change(h * 60 + (half ? 30 : 0), durationMin)} className={chip(h === hour)}>
                {h}시
              </button>
            ))}
          </div>
          {!closeOnPick && (
            <div className="mt-1 grid grid-cols-2 gap-1">
              {[false, true].map((isHalf) => (
                <button
                  key={String(isHalf)}
                  type="button"
                  disabled={hour === null}
                  aria-pressed={hour !== null && half === isHalf}
                  onClick={() => hour !== null && change(hour * 60 + (isHalf ? 30 : 0), durationMin)}
                  className={chip(hour !== null && half === isHalf)}
                >
                  {isHalf ? "30분" : "정각"}
                </button>
              ))}
            </div>
          )}
          {withDuration && !closeOnPick && (
            <>
              <p className={caption}>길이</p>
              <div className="grid grid-cols-5 gap-1">
                {LENGTHS.map((m) => (
                  <button
                    key={m}
                    type="button"
                    disabled={startMin === null}
                    aria-pressed={durationMin === m}
                    onClick={() => startMin !== null && change(startMin, m)}
                    className={`${chip(durationMin === m)} whitespace-nowrap px-0.5 text-[11px]`}
                  >
                    {LENGTH_LABELS[m]}
                  </button>
                ))}
              </div>
            </>
          )}
          {startMin !== null && (
            <button
              type="button"
              onClick={() => change(null, null)}
              className="mt-2 w-full rounded-md py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              시각 지우기
            </button>
          )}
        </div>
      )}
    </span>
  )
}
