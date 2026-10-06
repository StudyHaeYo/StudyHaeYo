"use client"

import { useState, type FormEvent } from "react"
import { UnderstandingRating } from "@/components/record/understanding-rating"
import { formatDate, todayISO, type PageStudyRecord } from "@/lib/study-pages"

interface AddRecordFormProps {
  pageId: string
  // When provided, the form edits this record instead of creating a new one.
  initial?: PageStudyRecord
  // Pre-filled study time for a new record (e.g. from a timer session).
  initialMinutes?: number
  onSubmit: (record: PageStudyRecord) => void
  onCancel: () => void
}

const fieldClass =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-500/30"

export function AddRecordForm({ pageId, initial, initialMinutes, onSubmit, onCancel }: AddRecordFormProps) {
  const isEdit = initial !== undefined
  const [date] = useState(() => initial?.date ?? todayISO())
  const [duration, setDuration] = useState(
    initial ? String(initial.durationMinutes) : initialMinutes ? String(initialMinutes) : "",
  )
  const [understanding, setUnderstanding] = useState<number | null>(initial?.understanding ?? null)
  const [studyContent, setStudyContent] = useState(initial?.studyContent ?? "")
  const [difficulties, setDifficulties] = useState(initial?.difficulties ?? "")
  const [nextSteps, setNextSteps] = useState(initial?.nextSteps ?? "")
  const [tags, setTags] = useState(initial ? initial.tags.join(", ") : "")

  const minutes = Number.parseInt(duration, 10)
  const canSubmit = Number.isFinite(minutes) && minutes > 0 && understanding !== null

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!canSubmit || understanding === null) return
    onSubmit({
      id: initial?.id ?? `${pageId}-r-${Date.now()}`,
      pageId,
      date,
      durationMinutes: minutes,
      understanding,
      studyContent: studyContent.trim(),
      difficulties: difficulties.trim(),
      nextSteps: nextSteps.trim(),
      tags: tags
        .split(",")
        .map((t) => t.trim().replace(/^#/, ""))
        .filter(Boolean),
    })
  }

  return (
    <form
      onSubmit={handleSubmit}
      aria-label={isEdit ? "학습 기록 수정" : "학습 기록 추가"}
      className="flex flex-col gap-4 rounded-xl border border-indigo-200 bg-card p-5 shadow-sm"
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-card-foreground">{isEdit ? "학습 기록 수정" : "새 학습 기록"}</p>
        <p className="text-xs text-muted-foreground">{formatDate(date)}</p>
      </div>

      <label className="flex flex-col gap-1.5 text-sm font-medium text-card-foreground">
        학습 시간 (분)
        <input
          type="number"
          inputMode="numeric"
          min={1}
          value={duration}
          onChange={(e) => setDuration(e.target.value)}
          placeholder="예: 60"
          className={`${fieldClass} sm:max-w-40`}
          autoFocus
        />
      </label>

      <UnderstandingRating value={understanding} onChange={setUnderstanding} />

      <label className="flex flex-col gap-1.5 text-sm font-medium text-card-foreground">
        오늘 공부한 내용
        <span className="text-xs font-normal text-muted-foreground">
          이번 학습에서 실제로 한 활동을 남겨요. 페이지 본문과는 별도로 저장돼요.
        </span>
        <textarea
          value={studyContent}
          onChange={(e) => setStudyContent(e.target.value)}
          rows={4}
          placeholder="예: 강의 3강 수강, 체이닝 직접 구현, 예제 5문제 풀이"
          className={`${fieldClass} resize-y`}
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-sm font-medium text-card-foreground">
          어려웠던 점
          <textarea
            value={difficulties}
            onChange={(e) => setDifficulties(e.target.value)}
            rows={3}
            placeholder="이해가 잘 안 됐던 부분"
            className={`${fieldClass} resize-none`}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium text-card-foreground">
          다음에 할 일
          <textarea
            value={nextSteps}
            onChange={(e) => setNextSteps(e.target.value)}
            rows={3}
            placeholder="다음 학습 때 이어서 할 일"
            className={`${fieldClass} resize-none`}
          />
        </label>
      </div>

      <label className="flex flex-col gap-1.5 text-sm font-medium text-card-foreground">
        태그
        <input
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="쉼표로 구분 (예: 해시, 충돌)"
          className={fieldClass}
        />
      </label>

      <div className="flex justify-end gap-2 border-t border-border pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          취소
        </button>
        <button
          type="submit"
          disabled={!canSubmit}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isEdit ? "수정 저장" : "기록 추가"}
        </button>
      </div>
    </form>
  )
}
