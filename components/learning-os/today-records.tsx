"use client"

import Link from "next/link"
import { Clock, Gauge, NotebookPen, Tag } from "lucide-react"
import { useTodayISO } from "@/hooks/use-today"
import { formatDuration } from "@/lib/study-pages"
import { todayRecords, type RecordEntry } from "@/lib/study-stats"
import { useWorkspace } from "@/lib/workspace"

export function TodayRecords() {
  const workspace = useWorkspace()
  const today = useTodayISO()
  const entries = today ? todayRecords(workspace, today) : null

  return (
    <section aria-labelledby="today-records-heading">
      <h2 id="today-records-heading" className="mb-3 text-sm font-medium text-foreground">
        오늘의 기록
      </h2>
      {entries === null ? (
        <div className="flex flex-col gap-3" aria-hidden="true">
          <div className="h-20 animate-pulse rounded-xl bg-muted" />
          <div className="h-20 animate-pulse rounded-xl bg-muted" />
        </div>
      ) : entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/50 px-6 py-12 text-center">
          <div className="mb-3 flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <NotebookPen className="size-5" />
          </div>
          <p className="text-sm font-medium text-foreground">오늘 아직 학습 기록이 없어요</p>
          <p className="mt-1 max-w-xs text-xs text-muted-foreground text-pretty">
            학습 노트를 열고 학습 기록을 추가하면 여기에 보여요.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {entries.map((entry) => (
            <li key={entry.record.id}>
              <TodayRecordCard entry={entry} />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function TodayRecordCard({ entry }: { entry: RecordEntry }) {
  const { record } = entry
  return (
    <Link
      href={`/record/${entry.pageId}`}
      className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="flex flex-col gap-1">
        <h3 className="text-base font-medium text-card-foreground">{entry.pageTitle}</h3>
        {record.studyContent && (
          <p className="line-clamp-1 text-sm text-muted-foreground">{record.studyContent}</p>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-1 font-medium text-foreground">
          <Tag className="size-3" />
          {entry.subject}
        </span>
        <span className="inline-flex items-center gap-1">
          <Clock className="size-3" />
          {formatDuration(record.durationMinutes)}
        </span>
        <span className="inline-flex items-center gap-1">
          <Gauge className="size-3" />
          {`이해도 ${record.understanding}/5`}
        </span>
      </div>
    </Link>
  )
}
