"use client"

import { Clock, Gauge, Pencil, Plus } from "lucide-react"
import { openQuickRecord } from "@/components/record/quick-record-dialog"
import { formatDate, formatDuration } from "@/lib/study-pages"
import { useSubjectRecordsReady, useWorkspace } from "@/lib/workspace"

// Records left directly on this subject, without a page (수업, 문제집 …). Each can be edited or moved onto a page.
export function SubjectStudyLog({ subjectId }: { subjectId: string }) {
  const workspace = useWorkspace()
  const ready = useSubjectRecordsReady()
  const records = workspace.subjectRecords
    .filter((r) => r.subjectId === subjectId)
    .sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt ?? 0) - (a.createdAt ?? 0))

  return (
    <section aria-labelledby="subject-log-title" className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 id="subject-log-title" className="text-base font-semibold text-foreground">
          과목 기록
          <span className="ml-2 text-sm font-normal text-muted-foreground">{records.length}</span>
        </h2>
        <button
          type="button"
          onClick={() => openQuickRecord({ subjectId })}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3.5 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
        >
          <Plus className="size-4" />
          기록 남기기
        </button>
      </div>

      {records.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-5 py-5 text-sm leading-relaxed text-muted-foreground">
          {ready
            ? "수업이나 문제집처럼 페이지 없이 공부한 것도 여기에 바로 남길 수 있어요. 시간과 이해도가 과목 통계에 들어가요."
            : "페이지 없이 과목에 바로 기록하는 기능은 DB 업데이트 후에 열려요. 지금은 기록할 페이지를 골라 주세요."}
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
          {records.map((record) => (
            <li key={record.id} className="flex items-start gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">{record.studyContent || "내용 없음"}</p>
                <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span>{formatDate(record.date)}</span>
                  <span className="inline-flex items-center gap-1">
                    <Clock className="size-3" aria-hidden="true" />
                    {formatDuration(record.durationMinutes)}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Gauge className="size-3" aria-hidden="true" />
                    {`이해도 ${record.understanding}/5`}
                  </span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => openQuickRecord({ edit: record })}
                title="고치기 · 페이지에 연결"
                aria-label="기록 고치기"
                className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <Pencil className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
