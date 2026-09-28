"use client"

import { useState } from "react"
import { History, Plus } from "lucide-react"
import { formatDate, sortRecordsNewestFirst, type PageStudyRecord } from "@/lib/study-pages"
import { AddRecordForm } from "@/components/study-page/add-record-form"

interface StudyHistoryProps {
  pageId: string
  records: PageStudyRecord[]
  onAdd: (record: PageStudyRecord) => void
}

export function StudyHistory({ pageId, records, onAdd }: StudyHistoryProps) {
  const [adding, setAdding] = useState(false)
  const [justAdded, setJustAdded] = useState<string | null>(null)
  const sorted = sortRecordsNewestFirst(records)

  return (
    <section aria-labelledby="study-history-heading" className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <History className="size-4 text-indigo-600" aria-hidden="true" />
          <h2 id="study-history-heading" className="text-sm font-semibold text-foreground">
            학습 기록
          </h2>
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
            {records.length}
          </span>
        </div>
        {!adding && (
          <button
            type="button"
            onClick={() => {
              setAdding(true)
              setJustAdded(null)
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground shadow-sm transition-colors hover:border-indigo-300 hover:text-indigo-600"
          >
            <Plus className="size-4" />
            학습 기록 추가
          </button>
        )}
      </div>

      {adding && (
        <AddRecordForm
          pageId={pageId}
          onCancel={() => setAdding(false)}
          onSubmit={(record) => {
            onAdd(record)
            setAdding(false)
            setJustAdded(record.id)
          }}
        />
      )}

      {justAdded && (
        <p role="status" className="rounded-lg bg-indigo-50 px-3 py-2 text-xs font-medium text-indigo-700">
          학습 기록이 추가되어 페이지 속성의 이해도와 복습 일정이 업데이트되었어요.
        </p>
      )}

      {sorted.length === 0 && !adding ? (
        <div className="rounded-xl border border-dashed border-border px-5 py-8 text-center">
          <p className="text-sm font-medium text-foreground">아직 학습 기록이 없어요</p>
          <p className="mt-1 text-pretty text-xs leading-relaxed text-muted-foreground">
            공부를 마친 뒤 학습 시간과 이해도를 기록하면 복습 일정이 자동으로 계산돼요.
          </p>
        </div>
      ) : (
        <ol className="flex flex-col">
          {sorted.map((record, index) => (
            <li key={record.id} className="relative flex gap-4 pb-5 last:pb-0">
              {index < sorted.length - 1 && (
                <span aria-hidden="true" className="absolute left-[5px] top-4 h-full w-px bg-border" />
              )}
              <span
                aria-hidden="true"
                className={`relative mt-1.5 size-[11px] shrink-0 rounded-full border-2 ${
                  index === 0 ? "border-indigo-600 bg-indigo-600" : "border-border bg-background"
                }`}
              />
              <div
                className={`flex min-w-0 flex-1 flex-col gap-2 rounded-xl border bg-card p-4 shadow-sm ${
                  record.id === justAdded ? "border-indigo-300" : "border-border"
                }`}
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-sm font-semibold text-card-foreground">{formatDate(record.date)}</p>
                  <p className="text-xs text-muted-foreground">
                    {record.durationMinutes}분 · 이해도 {record.understanding}/5
                  </p>
                </div>
                {record.difficulties && (
                  <div className="text-sm leading-relaxed">
                    <p className="text-xs font-medium text-muted-foreground">어려웠던 점</p>
                    <p className="text-card-foreground">{record.difficulties}</p>
                  </div>
                )}
                {record.nextSteps && (
                  <div className="text-sm leading-relaxed">
                    <p className="text-xs font-medium text-muted-foreground">다음에 할 일</p>
                    <p className="text-card-foreground">{record.nextSteps}</p>
                  </div>
                )}
                {record.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {record.tags.map((tag) => (
                      <span key={tag} className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
