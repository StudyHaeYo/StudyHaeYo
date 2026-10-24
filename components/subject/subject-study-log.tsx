"use client"

import Link from "next/link"
import { Clock, FileText, Gauge, Pencil, Plus } from "lucide-react"
import { openQuickRecord } from "@/components/record/quick-record-dialog"
import { formatDate, formatDuration } from "@/lib/study-pages"
import { allRecordEntries, entryTitle } from "@/lib/study-stats"
import { descendantGroups, useSubjectRecordsReady, useWorkspace } from "@/lib/workspace"

const LIMIT = 20

// 학습 기록 of a subject: every record in it, newest first — those on its notes (linked, open the note) and those
// left on the subject without a note (edit here, and link to a note later).
export function SubjectStudyLog({ subjectId }: { subjectId: string }) {
  const workspace = useWorkspace()
  const ready = useSubjectRecordsReady()
  const ids = new Set([subjectId, ...descendantGroups(workspace, subjectId).map((g) => g.id)])
  const entries = allRecordEntries(workspace)
    .filter((e) => e.subjectId !== null && ids.has(e.subjectId))
    .sort((a, b) => b.record.date.localeCompare(a.record.date) || (b.record.createdAt ?? 0) - (a.record.createdAt ?? 0))
  const subjectRecords = new Map(workspace.subjectRecords.map((r) => [r.id, r]))

  return (
    <section aria-labelledby="subject-log-title" className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 id="subject-log-title" className="text-base font-semibold text-foreground">
          학습 기록
          <span className="ml-2 text-sm font-normal text-muted-foreground">{entries.length}</span>
        </h2>
        {ready && (
          <button
            type="button"
            onClick={() => openQuickRecord({ subjectId })}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3.5 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            <Plus className="size-4" />
            기록 남기기
          </button>
        )}
      </div>

      {entries.length === 0 ? (
        <p className="border-y border-border py-5 text-sm leading-relaxed text-muted-foreground">
          {ready
            ? "아직 기록이 없어요. 노트에서 공부했으면 노트 아래에서, 수업이나 문제집처럼 노트 없이 공부했으면 [기록 남기기]로 남겨요."
            : "아직 기록이 없어요. 노트를 열고 아래의 학습 기록에서 남겨요."}
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-border border-y border-border">
          {entries.slice(0, LIMIT).map((entry) => {
            const { record } = entry
            const onSubject = subjectRecords.get(record.id)
            return (
              <li key={record.id} className="flex items-start gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">
                    {record.studyContent || (entry.pageTitle ? `${entry.pageTitle} 공부` : "내용 없음")}
                  </p>
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
                    {entry.pageId ? (
                      <Link
                        href={`/record/${entry.pageId}`}
                        className="inline-flex max-w-48 items-center gap-1 font-medium text-foreground hover:underline"
                      >
                        <FileText className="size-3 shrink-0" aria-hidden="true" />
                        <span className="truncate">{entryTitle(entry)}</span>
                      </Link>
                    ) : (
                      <span>노트 없음</span>
                    )}
                  </p>
                </div>
                {onSubject && (
                  <button
                    type="button"
                    onClick={() => openQuickRecord({ edit: onSubject })}
                    title="고치기 · 노트에 연결"
                    aria-label="기록 고치기"
                    className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  >
                    <Pencil className="size-4" />
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}
      {entries.length > LIMIT && (
        <p className="text-xs text-muted-foreground">{`최근 ${LIMIT}개만 보여요. 나머지는 각 노트에서 볼 수 있어요.`}</p>
      )}
    </section>
  )
}
