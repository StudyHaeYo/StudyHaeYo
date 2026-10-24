"use client"

import { useEffect, useRef } from "react"
import { createPortal } from "react-dom"
import { usePathname, useRouter } from "next/navigation"
import { BookMarked, Check, GraduationCap, Plus, Timer } from "lucide-react"
import { openQuickRecord } from "@/components/record/quick-record-dialog"
import { useSubjectRecordsReady, useWorkspace } from "@/lib/workspace"
import {
  closeSummary,
  formatDuration,
  hasRecordInWindow,
  msToMinutes,
  requestRecordPrefill,
  sessionDurationMs,
  totalsByPage,
  useStudySession,
} from "@/lib/study-session"
import { SessionIndicator } from "@/components/study-session/session-timer"

export function SessionSummaryModal() {
  const router = useRouter()
  const { pages, groups } = useWorkspace()
  const canQuickRecord = useSubjectRecordsReady()
  const { log, summarySessionId } = useStudySession()
  const closeRef = useRef<HTMLButtonElement>(null)
  const session = summarySessionId ? log.find((s) => s.id === summarySessionId) : undefined

  useEffect(() => {
    if (!session) return
    closeRef.current?.focus()
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeSummary()
    }
    document.addEventListener("keydown", handleKey)
    return () => document.removeEventListener("keydown", handleKey)
  }, [session])

  if (!session) return null

  const records = pages.flatMap((p) => p.studyRecords)
  const rows = totalsByPage(session.segments).map((row) => ({
    ...row,
    title: pages.find((p) => p.id === row.pageId)?.title || "제목 없음",
    recorded: hasRecordInWindow(records, row.pageId, session.startedAt, session.endedAt),
  }))
  const noteMs = rows.reduce((sum, row) => sum + row.ms, 0)
  // Time not spent on any page (수업, 문제집 …): offered as one record for the timer's subject.
  const offPageMinutes = Math.round(Math.max(0, sessionDurationMs(session) - noteMs) / 60_000)
  const subject = groups.find((g) => g.id === session.subjectId && g.kind === "subject")

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/30 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) closeSummary()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="session-summary-title"
        className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl"
      >
        <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Timer className="size-5" aria-hidden="true" />
        </div>
        <h2 id="session-summary-title" className="mt-4 text-base font-semibold text-foreground">
          학습 세션 요약
        </h2>
        <p className="mt-4 text-xs font-medium text-muted-foreground">학습 노트에서 보낸 시간 (노트별 합계)</p>
        <p className="mt-1 text-2xl font-semibold tracking-tight text-foreground">{formatDuration(noteMs)}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {`세션 경과 시간 ${formatDuration(sessionDurationMs(session))}`}
        </p>
        {session.autoEnded && (
          <p className="mt-3 rounded-lg bg-muted px-3 py-2 text-xs leading-relaxed text-muted-foreground">
            30분 넘게 활동이 없어 마지막 활동 시각에 세션을 자동으로 종료했어요.
          </p>
        )}

        <h3 className="mt-5 text-xs font-medium text-muted-foreground">학습 노트별 소요 시간</h3>
        {rows.length === 0 ? (
          <p className="mt-2 rounded-lg bg-muted px-3 py-3 text-sm leading-relaxed text-muted-foreground">
            이번 세션에 방문한 학습 노트가 없어요.
          </p>
        ) : (
          <ul className="mt-2 flex max-h-72 flex-col gap-1 overflow-y-auto">
            {rows.map((row) => (
              <li key={row.pageId} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-muted/60">
                <GraduationCap className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{row.title}</p>
                  <p className="text-xs text-muted-foreground">{formatDuration(row.ms)}</p>
                </div>
                {row.recorded ? (
                  <span className="inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                    <Check className="size-3.5" aria-hidden="true" />
                    기록됨
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      requestRecordPrefill(session.id, row.pageId, msToMinutes(row.ms))
                      router.push(`/record/${row.pageId}`)
                    }}
                    className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent"
                  >
                    <Plus className="size-3.5" aria-hidden="true" />
                    학습 기록 추가하기
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        {canQuickRecord && offPageMinutes >= 1 && (
          <div className="mt-4 flex items-center gap-3 rounded-lg border border-border px-3 py-2.5">
            <BookMarked className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">{subject ? subject.name : "페이지 밖에서 공부한 시간"}</p>
              <p className="text-xs text-muted-foreground">{`페이지 밖 ${offPageMinutes}분`}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                closeSummary()
                openQuickRecord({ subjectId: subject?.id ?? null, minutes: offPageMinutes })
              }}
              className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent"
            >
              <Plus className="size-3.5" aria-hidden="true" />
              {subject ? "과목에 기록" : "기록하기"}
            </button>
          </div>
        )}

        <div className="mt-6 flex justify-end">
          <button
            ref={closeRef}
            type="button"
            onClick={closeSummary}
            className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            닫기
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

// Mounted once in the root layout so tracking, the summary and the indicator work on every page.
export function StudySessionLayer() {
  const pathname = usePathname()
  return (
    <>
      {pathname !== "/" && <SessionIndicator floating />}
      <SessionSummaryModal />
    </>
  )
}
