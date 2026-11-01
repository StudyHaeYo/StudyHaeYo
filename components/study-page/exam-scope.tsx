"use client"

import Link from "next/link"
import { computePageStats, formatDate, type StudyPage } from "@/lib/study-pages"
import { examCountdown } from "@/components/study-page/page-properties"

// 시험 정리 (D-27): the notes in the exam scope, how well each is known, and when it comes up for review —
// pulled to the day before the exam when it would come later (same rule as the home review list).
export function ExamScope({
  examDate,
  scope,
  today,
}: {
  examDate: string | undefined
  scope: StudyPage[]
  today: string | null
}) {
  const countdown = examCountdown(examDate, today)
  const pullTo = examDate && today && examDate >= today ? (examDate > today ? prevDay(examDate) : today) : null
  const rows = scope.map((page) => {
    const stats = computePageStats(page, today)
    const next = stats.nextReviewAt && pullTo && stats.nextReviewAt > pullTo ? pullTo : stats.nextReviewAt
    return { page, stats, next, pulled: next !== stats.nextReviewAt }
  })
  const ready = rows.filter((r) => (r.stats.understanding ?? 0) >= 4).length

  return (
    <section aria-labelledby="exam-scope-heading" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="exam-scope-heading" className="text-base font-semibold text-foreground">
          시험 범위
          {countdown && (
            <span className="ml-2 rounded bg-indigo-50 px-1.5 py-0.5 align-middle text-xs font-medium text-indigo-700">{countdown}</span>
          )}
        </h2>
        {rows.length > 0 && (
          <p className="text-sm text-muted-foreground">
            이해도 4 이상 <span className="font-medium tabular-nums text-foreground">{ready}</span> / {rows.length}
          </p>
        )}
      </div>
      {rows.length > 0 && (
        <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
          <div className="h-full rounded-full bg-indigo-600 transition-[width]" style={{ width: `${(ready / rows.length) * 100}%` }} />
        </div>
      )}
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">속성의 “범위”에서 시험에 나오는 노트를 넣으면, 시험 전에 복습이 오도록 당겨 드려요.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border border-y border-border">
          {rows.map(({ page, stats, next, pulled }) => (
            <li key={page.id}>
              <Link
                href={`/record/${page.id}`}
                className="flex items-center gap-3 px-1 py-2.5 text-sm transition-colors hover:bg-muted/60"
              >
                <span className="min-w-0 flex-1 truncate font-medium text-foreground">{page.title || "제목 없음"}</span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {stats.understanding !== null ? `이해도 ${stats.understanding}/5` : "기록 없음"}
                </span>
                <span className={`w-28 shrink-0 text-right text-xs ${pulled ? "font-medium text-indigo-700" : "text-muted-foreground"}`}>
                  {next ? `복습 ${formatDate(next)}${pulled ? " (당김)" : ""}` : "복습 일정 없음"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function prevDay(iso: string) {
  const [y, m, d] = iso.split("-").map(Number)
  const date = new Date(y, m - 1, d - 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}
