"use client"

import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import Link from "next/link"
import { History, Plus } from "lucide-react"
import { openQuickRecord } from "@/components/record/quick-record-dialog"
import {
  addDays,
  daysBetween,
  formatDate,
  formatDuration,
  sortRecordsNewestFirst,
  type PageStats,
  type PageStudyRecord,
  type StudyPage,
} from "@/lib/study-pages"
import { recordBadge, recordText } from "@/lib/study-stats"

// 학습 기록 is a log of study, not part of the note (D-36): the note keeps its body, and its records open here from
// the top bar. Records are left in the record window and fixed or removed on 학습 기록 (filtered to the note).
// 시험 정리 has no study of its own: its window gathers the scope notes' records, read only, each with its note,
// and never folds their 이해도 into one number.

const RECENT = 3

export function RecordsButton({
  page,
  stats,
  today,
  scope,
}: {
  page: StudyPage
  stats: PageStats
  today: string | null
  // 시험 정리: the notes in its scope. null for every other note.
  scope: StudyPage[] | null
}) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const label = scope ? "범위 기록" : "기록"
  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        data-records-toggle
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
        // The app bar on a phone has its own "+ 기록" (leave a record); this one opens the note's records.
        aria-label={scope ? "범위 노트 학습 기록" : "이 노트의 학습 기록"}
        className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-2 text-[13px] font-semibold transition-colors ${
          open ? "bg-action-50 text-foreground" : "text-foreground hover:bg-accent"
        }`}
      >
        <History className="size-4 text-muted-foreground" aria-hidden="true" />
        {label}
      </button>
      {open && (
        <RecordsWindow
          anchorRef={triggerRef}
          page={page}
          stats={stats}
          today={today}
          scope={scope}
          onClose={(refocus) => {
            setOpen(false)
            if (refocus) triggerRef.current?.focus()
          }}
        />
      )}
    </>
  )
}

function RecordsWindow({
  anchorRef,
  page,
  stats,
  today,
  scope,
  onClose,
}: {
  anchorRef: React.RefObject<HTMLElement | null>
  page: StudyPage
  stats: PageStats
  today: string | null
  scope: StudyPage[] | null
  onClose: (refocus: boolean) => void
}) {
  const boxRef = useRef<HTMLDivElement>(null)
  // Portaled to <body> like the kind menu: the top bar's backdrop blur would trap the phone's bottom sheet.
  const [anchor, setAnchor] = useState<{ top: number; right: number } | null>(null)
  useLayoutEffect(() => {
    const place = () => {
      const rect = anchorRef.current?.getBoundingClientRect()
      if (rect) setAnchor({ top: rect.bottom + 8, right: Math.max(8, window.innerWidth - rect.right) })
    }
    place()
    window.addEventListener("resize", place)
    return () => window.removeEventListener("resize", place)
  }, [anchorRef])

  const closeRef = useRef(onClose)
  useLayoutEffect(() => {
    closeRef.current = onClose
  })
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (boxRef.current?.contains(target) || target.closest("[data-records-toggle]")) return
      closeRef.current(false)
    }
    document.addEventListener("mousedown", onDown)
    boxRef.current?.focus({ preventScroll: true })
    return () => document.removeEventListener("mousedown", onDown)
  }, [])

  const when = (date: string) => (today && date === today ? "오늘" : today && date === addDays(today, -1) ? "어제" : formatDate(date))
  const title = scope ? "범위 노트 학습 기록" : "이 노트의 학습 기록"

  // Every record shown here, newest first, with the note it belongs to.
  const rows: { record: PageStudyRecord; note: StudyPage }[] = scope
    ? scope.flatMap((note) => note.studyRecords.map((record) => ({ record, note })))
    : page.studyRecords.map((record) => ({ record, note: page }))
  const newest = sortRecordsNewestFirst(rows.map((r) => r.record))
  const noteOf = new Map(rows.map((r) => [r.record.id, r.note]))
  const recent = newest.slice(0, RECENT)
  const allHref = `/records?note=${(scope ?? [page]).map((p) => encodeURIComponent(p.id)).join(",")}`
  const total = newest.reduce((sum, r) => sum + r.durationMinutes, 0)

  let summary: React.ReactNode = null
  if (newest.length > 0) {
    if (scope) {
      summary = (
        <>
          범위 노트 <b className="font-semibold text-foreground">{scope.length}개</b> · 기록 <b className="font-semibold text-foreground">{newest.length}건</b> · 누적{" "}
          <b className="font-semibold text-foreground">{formatDuration(total)}</b>
        </>
      )
    } else {
      const trend = [...newest].reverse().slice(-6).map((r) => r.understanding)
      const late = stats.nextReviewAt && today ? daysBetween(stats.nextReviewAt, today) : 0
      summary = (
        <>
          이해도 <b className="font-semibold text-foreground">{trend.join(" → ")}</b> · 총 <b className="font-semibold text-foreground">{formatDuration(total)}</b>
          {stats.nextReviewAt && (
            <>
              {" "}· 다음 복습{" "}
              <b className={`font-semibold ${stats.status === "복습 필요" ? "text-attention-700" : "text-foreground"}`}>
                {formatDate(stats.nextReviewAt)}
                {late > 0 ? " · 다시 볼 때예요" : stats.status === "복습 필요" ? ", 오늘" : ""}
              </b>
            </>
          )}
        </>
      )
    }
  }

  const empty = scope
    ? scope.length === 0
      ? "범위에 노트를 넣으면 그 노트들의 기록이 여기 모여요."
      : "범위 노트에 아직 기록이 없어요. 각 노트에서 복습하거나 공부를 남기면 여기에 모여요."
    : "아직 기록이 없어요. 복습을 마치거나 공부한 것을 남기면 여기에 쌓여요."

  return createPortal(
    <>
      <div className="fixed inset-0 z-40 bg-foreground/25 md:hidden" aria-hidden="true" />
      <div
        ref={boxRef}
        role="dialog"
        aria-label={title}
        tabIndex={-1}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault()
            onClose(true)
          }
        }}
        // Tabbing out of the window closes it (it is not modal, so focus may go on to the page).
        onBlur={(e) => {
          const next = e.relatedTarget as HTMLElement | null
          if (next && !e.currentTarget.contains(next) && !next.closest("[data-records-toggle]")) onClose(false)
        }}
        style={anchor ? ({ "--top": `${anchor.top}px`, "--right": `${anchor.right}px` } as React.CSSProperties) : undefined}
        className="fixed inset-x-2 bottom-2 z-50 flex max-h-[80dvh] flex-col overflow-y-auto overscroll-contain rounded-3xl border border-border bg-popover p-4 shadow-2xl outline-none md:bottom-auto md:left-auto md:right-[var(--right)] md:top-[var(--top)] md:w-[26rem] md:rounded-2xl"
      >
        <div className="mx-auto -mt-1 mb-2 h-1 w-9 rounded-full bg-border md:hidden" aria-hidden="true" />
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-sm font-bold text-foreground">{title}</p>
          {newest.length > 0 && <span className="text-xs tabular-nums text-muted-foreground">{newest.length}개</span>}
        </div>
        {summary ? (
          <p className="mt-1.5 text-[13px] leading-relaxed tabular-nums text-muted-foreground">{summary}</p>
        ) : (
          <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{empty}</p>
        )}

        {recent.length > 0 && (
          <ul className="mt-3 flex flex-col border-t border-border">
            {recent.map((record) => {
              const note = noteOf.get(record.id) ?? page
              const badge = recordBadge(record.studyContent)
              const text = recordText({ record, pageId: note.id, pageTitle: note.title || "제목 없음", subject: "", subjectId: null })
              return (
                <li key={record.id} className="border-b border-border">
                  <Link
                    href={`/records?note=${encodeURIComponent(note.id)}`}
                    title="학습 기록에서 보기 · 고치기"
                    className="-mx-2 flex items-baseline gap-2.5 rounded-md px-2 py-2 text-[13px] transition-colors hover:bg-accent"
                  >
                    <span className="w-[3.75rem] shrink-0 whitespace-nowrap tabular-nums text-muted-foreground">{when(record.date)}</span>
                    <span className="min-w-0 flex-1 truncate text-foreground">
                      {scope && <span className="font-medium">{note.title || "제목 없음"} · </span>}
                      {badge && <span className="mr-1 text-muted-foreground">{badge}</span>}
                      {text}
                    </span>
                    <span className="shrink-0 whitespace-nowrap tabular-nums text-muted-foreground">
                      {formatDuration(record.durationMinutes)} · 이해도 {record.understanding}
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}

        <div className={`mt-3 flex flex-wrap items-center gap-2 ${scope ? "justify-end" : "justify-between"}`}>
          {!scope && (
            <button
              type="button"
              onClick={() => {
                onClose(false)
                openQuickRecord({ pageId: page.id })
              }}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-3 text-[13px] font-semibold text-foreground transition-colors hover:border-action-300 hover:text-action-700"
            >
              <Plus className="size-3.5" aria-hidden="true" />
              기록 남기기
            </button>
          )}
          {newest.length > 0 && (
            <Link href={allHref} className="text-[13px] font-semibold text-action-700 hover:underline">
              {scope ? "범위 노트 기록 모두 보기 →" : "학습 기록에서 모두 보기 →"}
            </Link>
          )}
        </div>
      </div>
    </>,
    document.body,
  )
}
