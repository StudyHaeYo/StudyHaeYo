"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"
import { isLockedOn } from "@/lib/templates"
import { useWorkspace } from "@/lib/workspace"
import { syncTrackedPage, useStudySession } from "@/lib/study-session"
import { usePageVisible } from "@/hooks/use-session-clock"

// Keeps the open segment in sync with the current route: only a visible locked-on page is tracked.
export function SessionTracker() {
  const pathname = usePathname()
  const { pages } = useWorkspace()
  const { startedAt } = useStudySession()
  const visible = usePageVisible()

  const routePageId = pathname.match(/^\/record\/([^/]+)/)?.[1] ?? null
  const routePage = routePageId ? pages.find((p) => p.id === routePageId) : undefined
  const trackedPageId = startedAt && visible && routePage && isLockedOn(routePage) ? routePage.id : null

  useEffect(() => {
    syncTrackedPage(trackedPageId)
  }, [trackedPageId, startedAt])

  return null
}
