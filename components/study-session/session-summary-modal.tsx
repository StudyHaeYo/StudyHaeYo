"use client"

import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { usePathname } from "next/navigation"
import { toast } from "sonner"
import { Check, X } from "lucide-react"
import { formatDuration, newRecordId, toISODate, type StudyRecordFields } from "@/lib/study-pages"
import { addPageRecord, addSubjectRecord, nearestSubject, useSubjectRecordsReady, useWorkspace } from "@/lib/workspace"
import { usePlans } from "@/lib/plans"
import { activePlans } from "@/lib/study-stats"
import {
  closeSummary,
  hasRecordInWindow,
  msToMinutes,
  sessionDurationMs,
  totalsByPage,
  useStudySession,
  type FinishedSession,
} from "@/lib/study-session"
import { SessionIndicator } from "@/components/study-session/session-timer"
import { useFocusTrap } from "@/hooks/use-focus-trap"

type Row = {
  key: string
  // A note, or null for the time spent outside the app's notes (수업, 문제집 …).
  pageId: string | null
  title: string
  minutes: string
  content: string
  understanding: number | null
  include: boolean
  // Already recorded during the session (review, AI grading, manual add): shown, not offered again.
  recorded: boolean
}

const OUTSIDE = "outside"

// 세션 마침 (D-28): the time is already split by note; pick 이해도 and save them all at once. Time spent outside
// the notes becomes one record for the timer's subject (or none). Records are stamped at the session's end so the
// timer doesn't count the same time again (D-10).
export function SessionSummaryModal() {
  const { log, summarySessionId } = useStudySession()
  const session = summarySessionId ? log.find((s) => s.id === summarySessionId) : undefined
  if (!session) return null
  return createPortal(<SummaryDialog key={session.id} session={session} />, document.body)
}

function SummaryDialog({ session }: { session: FinishedSession }) {
  const workspace = useWorkspace()
  const { pages, groups } = workspace
  const plans = usePlans()
  const ready = useSubjectRecordsReady()
  const dialogRef = useRef<HTMLDivElement>(null)
  useFocusTrap(dialogRef)

  const [rows, setRows] = useState<Row[]>(() => {
    const records = pages.flatMap((p) => p.studyRecords)
    const noteRows: Row[] = totalsByPage(session.segments)
      .filter(({ pageId }) => pages.some((p) => p.id === pageId))
      .map(({ pageId, ms }) => {
        const recorded = hasRecordInWindow(records, pageId, session.startedAt, session.endedAt)
        return {
          key: pageId,
          pageId,
          title: pages.find((p) => p.id === pageId)?.title || "제목 없음",
          minutes: String(msToMinutes(ms)),
          content: "",
          understanding: null,
          include: !recorded,
          recorded,
        }
      })
    const noteMs = totalsByPage(session.segments).reduce((sum, r) => sum + r.ms, 0)
    const outside = Math.round(Math.max(0, sessionDurationMs(session) - noteMs) / 60_000)
    const outsideRow: Row[] =
      ready && outside >= 1
        ? [{ key: OUTSIDE, pageId: null, title: "앱 밖에서 공부한 시간", minutes: String(outside), content: "", understanding: null, include: outside >= 5, recorded: false }]
        : []
    return [...noteRows, ...outsideRow]
  })
  const [subjectId, setSubjectId] = useState<string | null>(
    session.subjectId && groups.some((g) => g.id === session.subjectId && g.kind === "subject") ? session.subjectId : null,
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeSummary()
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [])

  const update = (key: string, patch: Partial<Row>) => setRows((list) => list.map((r) => (r.key === key ? { ...r, ...patch } : r)))
  const chosen = rows.filter((r) => r.include && !r.recorded)
  const minutesOf = (r: Row) => Number.parseInt(r.minutes, 10)
  const missing = chosen.find((r) => r.understanding === null || !(minutesOf(r) > 0))
  const total = formatDuration(Math.round(sessionDurationMs(session) / 60_000))
  const date = toISODate(new Date(session.endedAt))

  // Where saving moves a running plan (전체, or the subject the time goes to).
  const plan = activePlans(workspace, plans, date).find((p) => p.plan.target.scope === "all" || p.plan.target.scope === "subject")
  const added = chosen.reduce((sum, r) => {
    if (!plan || !(minutesOf(r) > 0)) return sum
    const target = plan.plan.target
    if (target.scope === "all") return sum + minutesOf(r)
    const sid = r.pageId ? nearestSubject(workspace, pages.find((p) => p.id === r.pageId)?.parentId ?? null)?.id : subjectId
    return target.scope === "subject" && sid === target.subjectId ? sum + minutesOf(r) : sum
  }, 0)

  const save = () => {
    if (chosen.length === 0 || missing) return
    for (const r of chosen) {
      const fields: StudyRecordFields = {
        id: newRecordId(),
        date,
        createdAt: session.endedAt,
        durationMinutes: minutesOf(r),
        understanding: r.understanding!,
        studyContent: r.content.trim(),
        difficulties: "",
        nextSteps: "",
        tags: [],
      }
      if (r.pageId) addPageRecord(r.pageId, { ...fields, pageId: r.pageId })
      else addSubjectRecord({ ...fields, subjectId })
    }
    closeSummary()
    toast.success(`기록 ${chosen.length}개를 남겼어요`)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/30 sm:items-center sm:p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) closeSummary()
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="session-summary-title"
        className="flex max-h-[92dvh] w-full max-w-xl flex-col overflow-y-auto overscroll-contain rounded-t-3xl bg-card shadow-2xl sm:rounded-2xl"
      >
        <div className="flex items-start justify-between gap-3 px-5 pt-4">
          <div>
            <p className="text-sm font-semibold text-foreground">학습 세션을 마쳤어요</p>
            <h2 id="session-summary-title" className="mt-1 text-xl font-bold tracking-tight text-foreground">
              {total} 공부했어요
            </h2>
            <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
              {session.autoEnded
                ? "30분 넘게 활동이 없어 마지막 활동 시각에 세션을 끝냈어요. "
                : ""}
              노트에서 공부한 시간은 노트별로, 앱 밖에서 공부한 시간은 따로 나눠 뒀어요.
            </p>
          </div>
          <button
            type="button"
            onClick={closeSummary}
            aria-label="닫기"
            className="-mr-2 flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        {rows.length === 0 ? (
          <p className="mx-5 mt-4 rounded-xl border border-dashed border-border px-4 py-5 text-sm text-muted-foreground">
            이번 세션에 남길 시간이 없어요.
          </p>
        ) : (
          <ul className="mx-5 mt-4 flex flex-col divide-y divide-border border-y border-border">
            {rows.map((r) => (
              <li key={r.key} className={`flex gap-3 py-3.5 ${r.recorded ? "opacity-60" : ""}`}>
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={r.include && !r.recorded}
                  aria-label={`${r.title} 기록하기`}
                  disabled={r.recorded}
                  onClick={() => update(r.key, { include: !r.include })}
                  className={`mt-0.5 flex size-[18px] shrink-0 items-center justify-center rounded-[5px] border transition-colors ${
                    r.include && !r.recorded ? "border-indigo-600 bg-indigo-600 text-white" : "border-muted-foreground/40 bg-background"
                  }`}
                >
                  {r.include && !r.recorded && <Check className="size-3" />}
                </button>
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className={`truncate text-sm font-semibold ${r.pageId ? "text-foreground" : "text-foreground"}`}>{r.title}</p>
                    {r.recorded ? (
                      <span className="shrink-0 text-xs font-semibold text-emerald-700">이미 기록됨</span>
                    ) : (
                      <label className="flex shrink-0 items-center gap-1 text-sm tabular-nums text-foreground">
                        <input
                          type="number"
                          min={1}
                          inputMode="numeric"
                          aria-label={`${r.title} 공부한 시간(분)`}
                          value={r.minutes}
                          onChange={(e) => update(r.key, { minutes: e.target.value, include: true })}
                          className="w-12 rounded-md bg-transparent px-1 text-right font-semibold outline-none [appearance:textfield] focus:bg-muted [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        분
                      </label>
                    )}
                  </div>
                  {!r.recorded && (
                    <>
                      <input
                        value={r.content}
                        onChange={(e) => update(r.key, { content: e.target.value, include: true })}
                        aria-label={`${r.title}에서 무엇을 했나요`}
                        autoComplete="off"
                        placeholder={r.pageId ? "무엇을 했나요? (비워 둬도 돼요)" : "무엇을 했나요? 예: 문제집 3장, 학교 수업…"}
                        className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground/70 focus:border-indigo-400"
                      />
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        {!r.pageId ? (
                          <select
                            aria-label="과목"
                            value={subjectId ?? ""}
                            onChange={(e) => setSubjectId(e.target.value || null)}
                            className="h-8 rounded-lg bg-muted px-2 text-xs text-foreground outline-none"
                          >
                            <option value="">과목 없음</option>
                            {groups
                              .filter((g) => g.kind === "subject")
                              .map((g) => (
                                <option key={g.id} value={g.id}>
                                  {g.name}
                                </option>
                              ))}
                          </select>
                        ) : (
                          <span />
                        )}
                        <span role="radiogroup" aria-label={`${r.title} 이해도`} className="flex items-center gap-1">
                          <span className="mr-1 text-xs text-muted-foreground">이해도</span>
                          {[1, 2, 3, 4, 5].map((n) => (
                            <button
                              key={n}
                              type="button"
                              role="radio"
                              aria-checked={r.understanding === n}
                              aria-label={`이해도 ${n}`}
                              onClick={() => update(r.key, { understanding: n, include: true })}
                              className={`flex size-6 items-center justify-center rounded-md text-xs font-semibold transition-colors ${
                                r.understanding !== null && n <= r.understanding
                                  ? "bg-indigo-600 text-white"
                                  : "border border-indigo-200 text-muted-foreground hover:border-indigo-400"
                              }`}
                            >
                              {n}
                            </button>
                          ))}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-border bg-muted/30 px-5 py-3.5 sm:flex-nowrap">
          <p role="status" className="min-w-0 flex-1 basis-full text-[13px] leading-relaxed text-muted-foreground sm:basis-auto">
            {missing
              ? `${missing.title}의 이해도를 골라 주세요.`
              : plan && added > 0
                ? `기록하면 “${plan.plan.title}” ${formatDuration(plan.studiedMinutes)} → ${formatDuration(plan.studiedMinutes + added)}${plan.plan.goalMinutes ? ` / ${formatDuration(plan.plan.goalMinutes)}` : ""}`
                : "기록하면 홈 · 학습 분석 · 계획에 바로 반영돼요."}
          </p>
          <button
            type="button"
            onClick={closeSummary}
            className="h-10 rounded-xl px-4 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            나중에
          </button>
          <button
            type="button"
            onClick={save}
            disabled={chosen.length === 0 || Boolean(missing)}
            className="h-10 flex-1 rounded-xl bg-indigo-600 px-5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40 sm:flex-none"
          >
            {chosen.length > 0 ? `${chosen.length}개 기록 남기기` : "기록 남기기"}
          </button>
        </div>
      </div>
    </div>
  )
}

// Mounted once in the root layout so tracking, the summary and the indicator work on every page.
// A note page shows the indicator in its own top bar (D-28), so the floating one stays off there.
export function StudySessionLayer() {
  const pathname = usePathname()
  return (
    <>
      {pathname !== "/" && !pathname.startsWith("/record/") && <SessionIndicator floating />}
      <SessionSummaryModal />
    </>
  )
}
