"use client"

import Link from "next/link"
import { X } from "lucide-react"
import { computePageStats, formatDate, reviewActionLabel, type StudyPage } from "@/lib/study-pages"
import { noteIcon } from "@/lib/templates"
import { examCountdown } from "@/components/study-page/page-properties"

// 시험 정리 (D-27, D-30): the exam date and the notes in its scope, set right here at the top of the note instead
// of in a 속성 window. Each note shows how well it is known and when it comes up for review — pulled to the day
// before the exam when it would come later (same rule as the home review list).
export function ExamScope({
  examDate,
  onChangeDate,
  scope,
  options,
  onChangeScope,
  today,
}: {
  examDate: string | undefined
  onChangeDate: (date: string | undefined) => void
  scope: StudyPage[]
  // Notes that can go in the scope (same subject first).
  options: { id: string; title: string }[]
  onChangeScope: (ids: string[]) => void
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
  // "이해도 4 이상 0 / 2" before any note in scope has a record reads like a failing grade; show it once one has.
  const anyRecorded = rows.some((r) => r.stats.understanding !== null)
  const ids = scope.map((p) => p.id)
  const rest = options.filter((o) => !ids.includes(o.id))

  return (
    <section aria-labelledby="exam-scope-heading" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border pb-4">
        <label htmlFor="exam-date" className="text-sm text-muted-foreground">
          시험일
        </label>
        <input
          id="exam-date"
          type="date"
          value={examDate ?? ""}
          onChange={(e) => onChangeDate(e.target.value || undefined)}
          className="h-9 scroll-mt-24 rounded-lg border border-border bg-background px-2.5 text-sm text-foreground outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50"
        />
        {countdown && <span className="text-sm font-semibold tabular-nums text-amber-700">{countdown}</span>}
      </div>

      <div className="flex flex-wrap items-baseline justify-between gap-2 pt-1">
        <h2 id="exam-scope-heading" className="text-base font-semibold text-foreground">
          범위 <span className="ml-1 text-sm font-medium text-muted-foreground">{rows.length}</span>
        </h2>
        {anyRecorded && (
          <p className="text-sm text-muted-foreground">
            이해도 4 이상 <span className="font-medium tabular-nums text-foreground">{ready}</span> / {rows.length}
          </p>
        )}
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">시험에 나오는 노트를 넣으면, 시험 전에 복습이 오도록 당겨 드려요.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border border-y border-border">
          {rows.map(({ page, stats, next, pulled }) => {
            const Icon = noteIcon(page)
            const due = stats.status === "복습 필요"
            return (
              <li key={page.id} className="flex items-center gap-1">
                <Link
                  href={due ? `/record/${page.id}?mode=review` : `/record/${page.id}`}
                  className="flex min-w-0 flex-1 items-center gap-3 rounded-md px-1 py-2.5 text-sm transition-colors hover:bg-muted/60"
                >
                  <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate font-medium text-foreground">{page.title || "제목 없음"}</span>
                  <span className="hidden shrink-0 tabular-nums text-muted-foreground sm:inline">
                    {stats.understanding !== null ? `이해도 ${stats.understanding}/5` : "기록 없음"}
                  </span>
                  <span className={`shrink-0 text-right text-xs tabular-nums ${pulled ? "font-medium text-indigo-700" : "text-muted-foreground"}`}>
                    {next ? `복습 ${formatDate(next)}${pulled ? " (당김)" : ""}` : "복습 일정 없음"}
                  </span>
                  {due && <span className="shrink-0 text-xs font-semibold text-indigo-700">{reviewActionLabel(page)}</span>}
                </Link>
                <button
                  type="button"
                  onClick={() => onChangeScope(ids.filter((id) => id !== page.id))}
                  aria-label={`${page.title || "제목 없음"} 범위에서 빼기`}
                  className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <X className="size-3.5" aria-hidden="true" />
                </button>
              </li>
            )
          })}
        </ul>
      )}
      {rest.length > 0 && (
        <label className="self-start">
          <span className="sr-only">범위에 노트 넣기</span>
          <select
            value=""
            onChange={(e) => e.target.value && onChangeScope([...ids, e.target.value])}
            className="h-8 rounded-lg border border-dashed border-border bg-background px-2 text-sm text-muted-foreground outline-none hover:text-foreground focus:border-indigo-400"
          >
            <option value="">+ 노트 넣기</option>
            {rest.map((o) => (
              <option key={o.id} value={o.id}>
                {o.title || "제목 없음"}
              </option>
            ))}
          </select>
        </label>
      )}
    </section>
  )
}

function prevDay(iso: string) {
  const [y, m, d] = iso.split("-").map(Number)
  const date = new Date(y, m - 1, d - 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}
