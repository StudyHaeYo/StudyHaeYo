"use client"

import { useState } from "react"
import { History, Pencil, Plus, Trash2 } from "lucide-react"
import { formatDate, sortRecordsNewestFirst, type PageStudyRecord } from "@/lib/study-pages"
import { AddRecordForm } from "@/components/study-page/add-record-form"
import { ConfirmDeleteModal } from "@/components/sidebar/confirm-delete-modal"

interface StudyHistoryProps {
  pageId: string
  records: PageStudyRecord[]
  onAdd: (record: PageStudyRecord) => void
  onUpdate: (record: PageStudyRecord) => void
  onDelete: (recordId: string) => void
}

type Notice = { recordId: string | null; message: string }

export function StudyHistory({ pageId, records, onAdd, onUpdate, onDelete }: StudyHistoryProps) {
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<PageStudyRecord | null>(null)
  const [notice, setNotice] = useState<Notice | null>(null)
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
              setEditingId(null)
              setNotice(null)
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
            setNotice({
              recordId: record.id,
              message: "학습 기록이 추가되어 페이지 속성의 이해도와 복습 일정이 업데이트되었어요.",
            })
          }}
        />
      )}

      {notice && (
        <p role="status" className="rounded-lg bg-indigo-50 px-3 py-2 text-xs font-medium text-indigo-700">
          {notice.message}
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
              {editingId === record.id ? (
                <div className="min-w-0 flex-1">
                  <AddRecordForm
                    pageId={pageId}
                    initial={record}
                    onCancel={() => setEditingId(null)}
                    onSubmit={(updated) => {
                      onUpdate(updated)
                      setEditingId(null)
                      setNotice({ recordId: updated.id, message: "학습 기록을 수정했어요." })
                    }}
                  />
                </div>
              ) : (
                <RecordCard
                  record={record}
                  highlighted={record.id === notice?.recordId}
                  onEdit={() => {
                    setEditingId(record.id)
                    setAdding(false)
                    setNotice(null)
                  }}
                  onDelete={() => setDeleteTarget(record)}
                />
              )}
            </li>
          ))}
        </ol>
      )}

      <ConfirmDeleteModal
        open={deleteTarget !== null}
        title={deleteTarget ? `${formatDate(deleteTarget.date)} 학습 기록` : ""}
        targetLabel="기록"
        note="삭제하면 총 학습 시간과 복습 일정에서도 빠져요."
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (!deleteTarget) return
          onDelete(deleteTarget.id)
          if (editingId === deleteTarget.id) setEditingId(null)
          setDeleteTarget(null)
          setNotice({ recordId: null, message: "학습 기록을 삭제했어요." })
        }}
      />
    </section>
  )
}

function RecordCard({
  record,
  highlighted,
  onEdit,
  onDelete,
}: {
  record: PageStudyRecord
  highlighted: boolean
  onEdit: () => void
  onDelete: () => void
}) {
  const dateLabel = formatDate(record.date)
  return (
    <div
      className={`group flex min-w-0 flex-1 flex-col gap-2 rounded-xl border bg-card p-4 shadow-sm ${
        highlighted ? "border-indigo-300" : "border-border"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-card-foreground">{dateLabel}</p>
        <div className="flex items-center gap-1">
          <p className="mr-1 text-xs text-muted-foreground">
            {record.durationMinutes}분 · 이해도 {record.understanding}/5
          </p>
          <button
            type="button"
            onClick={onEdit}
            aria-label={`${dateLabel} 학습 기록 수정`}
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Pencil className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            aria-label={`${dateLabel} 학습 기록 삭제`}
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </div>
      {record.studyContent && (
        <div className="text-sm leading-relaxed">
          <p className="text-xs font-medium text-muted-foreground">오늘 공부한 내용</p>
          <p className="whitespace-pre-line text-card-foreground">{record.studyContent}</p>
        </div>
      )}
      {record.difficulties && (
        <div className="text-sm leading-relaxed">
          <p className="text-xs font-medium text-muted-foreground">어려웠던 점</p>
          <p className="whitespace-pre-line text-card-foreground">{record.difficulties}</p>
        </div>
      )}
      {record.nextSteps && (
        <div className="text-sm leading-relaxed">
          <p className="text-xs font-medium text-muted-foreground">다음에 할 일</p>
          <p className="whitespace-pre-line text-card-foreground">{record.nextSteps}</p>
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
  )
}
