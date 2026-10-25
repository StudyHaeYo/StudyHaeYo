"use client"

import Link from "next/link"
import { Clock, Gauge, Tag } from "lucide-react"
import { useTodayISO } from "@/hooks/use-today"
import { formatDuration } from "@/lib/study-pages"
import { entryHref, entryTitle, todayRecords, type RecordEntry } from "@/lib/study-stats"
import { useSubjectRecordsReady, useWorkspace } from "@/lib/workspace"

export function TodayRecords() {
  const workspace = useWorkspace()
  const today = useTodayISO()
  const entries = today ? todayRecords(workspace, today) : null
  // [+ 기록] is hidden until records can be saved without a note (DB migration), so point at the note instead.
  const canQuickRecord = useSubjectRecordsReady()

  return (
    <section aria-labelledby="today-records-heading">
      <h2 id="today-records-heading" className="mb-1 border-b border-border pb-2 text-base font-semibold text-foreground">
        오늘의 기록
      </h2>
      {entries === null ? (
        <div className="flex flex-col gap-3" aria-hidden="true">
          <div className="h-20 animate-pulse rounded-xl bg-muted" />
          <div className="h-20 animate-pulse rounded-xl bg-muted" />
        </div>
      ) : entries.length === 0 ? (
        <div className="py-3">
          <p className="text-sm text-muted-foreground">오늘 아직 학습 기록이 없어요.</p>
          <p className="mt-0.5 text-xs text-muted-foreground text-pretty">
            {canQuickRecord ? "공부를 마치고 [+ 기록]으로 남기면 여기에 보여요." : "노트 아래 학습 기록이나 AI 문제 풀이 결과를 남기면 여기에 보여요."}
          </p>
        </div>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
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
      href={entryHref(entry)}
      className="-mx-2 flex flex-col gap-1.5 rounded-lg px-2 py-3 transition-colors hover:bg-accent"
    >
      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-medium text-foreground">{entryTitle(entry)}</h3>
        {record.studyContent && entry.pageId && (
          <p className="line-clamp-1 text-sm text-muted-foreground">{record.studyContent}</p>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
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
