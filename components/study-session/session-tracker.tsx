"use client"

import { useEffect, useRef } from "react"
import { usePathname } from "next/navigation"
import { isStudyOn } from "@/lib/templates"
import { useWorkspace } from "@/lib/workspace"
import {
  HEARTBEAT_MS,
  heartbeat,
  recoverStaleSession,
  suspendTracking,
  syncTrackedPage,
  useStudySession,
} from "@/lib/study-session"
import { usePageVisible } from "@/hooks/use-session-clock"
import { usePomodoro } from "@/lib/pomodoro"

// Keeps the open segment in sync with the current route: only a visible page with study on is tracked,
// and nothing is tracked during a pomodoro break.
export function SessionTracker() {
  const pathname = usePathname()
  const { pages } = useWorkspace()
  const { startedAt } = useStudySession()
  const visible = usePageVisible()
  const onBreak = usePomodoro().phase === "break"
  const trackedRef = useRef<string | null>(null)

  const routePageId = pathname.match(/^\/record\/([^/]+)/)?.[1] ?? null
  const routePage = routePageId ? pages.find((p) => p.id === routePageId) : undefined
  const trackedPageId = startedAt && visible && !onBreak && routePage && isStudyOn(routePage) ? routePage.id : null

  // Declared first so stale segments from a previous load are closed before tracking resumes.
  useEffect(() => {
    recoverStaleSession()
  }, [])

  useEffect(() => {
    trackedRef.current = trackedPageId
    syncTrackedPage(trackedPageId)
  }, [trackedPageId, startedAt])

  useEffect(() => {
    if (!startedAt || !visible) return
    const id = window.setInterval(() => heartbeat(trackedRef.current), HEARTBEAT_MS)
    return () => window.clearInterval(id)
  }, [startedAt, visible])

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") suspendTracking()
    }
    // Restored from the back/forward cache: no route or visibility change fires, so resume explicitly.
    const handlePageShow = (e: PageTransitionEvent) => {
      if (e.persisted) heartbeat(trackedRef.current)
    }
    window.addEventListener("pagehide", suspendTracking)
    window.addEventListener("pageshow", handlePageShow)
    document.addEventListener("visibilitychange", handleVisibility)
    return () => {
      window.removeEventListener("pagehide", suspendTracking)
      window.removeEventListener("pageshow", handlePageShow)
      document.removeEventListener("visibilitychange", handleVisibility)
    }
  }, [])

  return null
}
