"use client"

import { formatDuration, useStudySession } from "@/lib/study-session"
import { useNowEverySecond } from "@/hooks/use-session-clock"

// Total time the study timer has tracked on this page (finished sessions + the running one).
// Isolated so the per-second tick only re-renders this value, not the whole page.
export function PageSessionTime({ pageId }: { pageId: string }) {
  const { log, segments, openSegment } = useStudySession()
  const now = useNowEverySecond()

  let ms = 0
  for (const session of log) for (const seg of session.segments) if (seg.pageId === pageId) ms += seg.end - seg.start
  for (const seg of segments) if (seg.pageId === pageId) ms += seg.end - seg.start
  const live = openSegment?.pageId === pageId
  if (live && now !== null) ms += Math.max(0, now - openSegment.start)

  if (ms <= 0) return <span className="text-muted-foreground/70">{live ? "측정 중" : "기록 없음"}</span>

  return (
    <span className="inline-flex items-center gap-1.5">
      {formatDuration(ms)}
      {live && (
        <span className="inline-flex items-center gap-1 text-xs text-indigo-700">
          <span className="size-1.5 animate-pulse rounded-full bg-indigo-600" aria-hidden="true" />
          측정 중
        </span>
      )}
    </span>
  )
}
