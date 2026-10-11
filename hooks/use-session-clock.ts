"use client"

import { useSyncExternalStore } from "react"

function subscribeSeconds(onChange: () => void) {
  const id = window.setInterval(onChange, 1000)
  return () => window.clearInterval(id)
}

// Whole-second snapshot keeps useSyncExternalStore stable between ticks.
function getSecondNow() {
  return Math.floor(Date.now() / 1000) * 1000
}

const getServerNull = () => null

// Same pattern as useTodayISO: null on the server and during hydration, live on the client.
export function useNowEverySecond(): number | null {
  return useSyncExternalStore(subscribeSeconds, getSecondNow, getServerNull)
}

function subscribeVisibility(onChange: () => void) {
  document.addEventListener("visibilitychange", onChange)
  return () => document.removeEventListener("visibilitychange", onChange)
}

export function usePageVisible(): boolean {
  return useSyncExternalStore(
    subscribeVisibility,
    () => document.visibilityState === "visible",
    () => false,
  )
}
