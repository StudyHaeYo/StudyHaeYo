"use client"

import { useEffect } from "react"
import { flushScheduledWrites, hasUnsavedWrites } from "@/lib/db/queue"
import { startDataSync } from "@/lib/db/sync"

// Loads the signed-in user's data and keeps it tied to the auth session (lib/db/sync.ts). Renders nothing.
export function DataSync() {
  useEffect(() => startDataSync(), [])

  useEffect(() => {
    // Send debounced edits as soon as the tab is hidden, and warn before closing while a save is still pending.
    const onHidden = () => {
      if (document.visibilityState === "hidden") flushScheduledWrites()
    }
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!hasUnsavedWrites()) return
      flushScheduledWrites()
      e.preventDefault()
    }
    document.addEventListener("visibilitychange", onHidden)
    window.addEventListener("beforeunload", onBeforeUnload)
    return () => {
      document.removeEventListener("visibilitychange", onHidden)
      window.removeEventListener("beforeunload", onBeforeUnload)
    }
  }, [])

  return null
}
