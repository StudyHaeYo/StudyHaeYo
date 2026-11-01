"use client"

import { Plus } from "lucide-react"
import { openQuickRecord } from "@/components/record/quick-record-dialog"
import { RecordRow } from "@/components/record/record-row"
import { addDays, daysBetween, formatDate, formatDuration, sortRecordsNewestFirst, type PageStats, type StudyPage } from "@/lib/study-pages"
import type { RecordEntry } from "@/lib/study-stats"

// 학습 기록 under a note (D-28): how understanding has moved and why the next review is when it is, a one-line way
// to add today's study, then the records — the same rows as 학습 기록 · 홈 · 과목.
export function PageRecords({
  page,
  stats,
  today,
  subject,
}: {
  page: StudyPage
  stats: PageStats
  today: string | null
  subject: { id: string; name: string } | null
}) {
  const records = sortRecordsNewestFirst(page.studyRecords)
  const oldestFirst = [...records].reverse().slice(-8)
  const latest = records[0]
  const overdue = stats.nextReviewAt && today ? daysBetween(stats.nextReviewAt, today) : 0
  const add = () => openQuickRecord({ pageId: page.id })
  const when = (date: string) =>
    today && date === today ? "오늘" : today && date === addDays(today, -1) ? "어제" : formatDate(date)

  return (
    <section aria-labelledby="page-records-heading" className="flex flex-col">
      <div className="flex items-center justify-between gap-3">
        <h2 id="page-records-heading" className="text-lg font-bold tracking-tight text-foreground">
          학습 기록
          <span className="ml-1.5 text-sm font-medium text-muted-foreground">{records.length}</span>
        </h2>
        <button
          type="button"
          onClick={add}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-semibold text-foreground transition-colors hover:border-indigo-300 hover:text-indigo-700"
        >
          <Plus className="size-4" aria-hidden="true" />
          기록 남기기
        </button>
      </div>

      {latest && (
        <div className="mt-3 flex items-center gap-4 rounded-xl bg-muted/60 px-4 py-3">
          <div className="flex h-7 items-end gap-1" aria-hidden="true">
            {oldestFirst.map((r, i) => (
              <span
                key={r.id}
                className={`w-3 rounded-[3px] ${i === oldestFirst.length - 1 ? "bg-indigo-600" : "bg-indigo-200"}`}
                style={{ height: `${8 + r.understanding * 4}px` }}
              />
            ))}
          </div>
          <div className="min-w-0 text-[13px] leading-relaxed text-muted-foreground">
            <p>
              이해도 <b className="font-semibold text-foreground">{oldestFirst.map((r) => r.understanding).join(" → ")}</b> · 총{" "}
              <b className="font-semibold text-foreground">{formatDuration(stats.totalDurationMinutes)}</b>
            </p>
            {stats.nextReviewAt && (
              <p>
                다음 복습{" "}
                <b className={`font-semibold ${stats.status === "복습 필요" ? "text-amber-700" : "text-foreground"}`}>
                  {formatDate(stats.nextReviewAt)}
                  {overdue > 0 ? ` (${overdue}일 지남)` : stats.status === "복습 필요" ? " (오늘)" : ""}
                </b>{" "}
                · 마지막 기록의 이해도 {latest.understanding}로 정해졌어요
              </p>
            )}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={add}
        className="mt-3 flex h-11 items-center gap-2.5 rounded-xl border border-border px-3.5 text-left text-sm text-muted-foreground transition-colors hover:border-indigo-300 hover:text-foreground"
      >
        <Plus className="size-4" aria-hidden="true" />
        {records.length === 0 ? "공부를 마쳤으면 기록을 남겨 보세요 · 복습일이 잡혀요" : "오늘 이 노트로 공부한 것 남기기…"}
      </button>

      {records.length > 0 && (
        <ul className="mt-1 flex flex-col divide-y divide-border">
          {records.map((record) => {
            const entry: RecordEntry = {
              record,
              pageId: page.id,
              pageTitle: page.title || "제목 없음",
              subject: subject?.name ?? "",
              subjectId: subject?.id ?? null,
            }
            return (
              <li key={record.id}>
                <RecordRow entry={entry} showWhere={false} when={when(record.date)} />
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
