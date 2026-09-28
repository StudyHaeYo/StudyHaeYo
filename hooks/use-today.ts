"use client"

import { useSyncExternalStore } from "react"

// Refresh once a minute so the value rolls over at midnight.
function subscribe(onChange: () => void) {
  const id = window.setInterval(onChange, 60_000)
  return () => window.clearInterval(id)
}

// A primitive string snapshot keeps useSyncExternalStore stable between reads.
function getTodayKey() {
  const now = new Date()
  const m = String(now.getMonth() + 1).padStart(2, "0")
  const d = String(now.getDate()).padStart(2, "0")
  return `${now.getFullYear()}-${m}-${d}`
}

// The server and the hydration pass both see null; the browser's local date
// is only read after hydration, so server and client markup always match.
function getServerSnapshot() {
  return null
}

export function useTodayISO(): string | null {
  return useSyncExternalStore(subscribe, getTodayKey, getServerSnapshot)
}

export function useToday(): Date | null {
  const key = useSyncExternalStore(subscribe, getTodayKey, getServerSnapshot)
  if (!key) return null
  const [y, m, d] = key.split("-").map(Number)
  return new Date(y, m - 1, d)
}

const koreanDateFormatter = new Intl.DateTimeFormat("ko-KR", {
  year: "numeric",
  month: "long",
  day: "numeric",
  weekday: "long",
})

export function useTodayLabel() {
  const today = useToday()
  return today ? koreanDateFormatter.format(today) : ""
}
