"use client"

import { useState, type FormEvent } from "react"
import { UnderstandingRating } from "@/components/record/understanding-rating"
import { formatDate, todayISO, type PageStudyRecord } from "@/lib/study-pages"

interface AddRecordFormProps {
  pageId: string
  onSubmit: (record: PageStudyRecord) => void
  onCancel: () => void
}

const fieldClass =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-500/30"

export function AddRecordForm({ pageId, onSubmit, onCancel }: AddRecordFormProps) {
  const [date] = useState(todayISO)
  const [duration, setDuration] = useState("")
  const [understanding, setUnderstanding] = useState<number | null>(null)
  const [difficulties, setDifficulties] = useState("")
  const [nextSteps, setNextSteps] = useState("")
  const [tags, setTags] = useState("")

  const minutes = Number.parseInt(duration, 10)
  const canSubmit = Number.isFinite(minutes) && minutes > 0 && understanding !== null

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!canSubmit || understanding === null) return
    onSubmit({
      id: `${pageId}-r-${Date.now()}`,
      pageId,
      date,
      durationMinutes: minutes,
      understanding,
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
      aria-label="학습 기록 추가"
      className="flex flex-col gap-4 rounded-xl border border-indigo-200 bg-card p-5 shadow-sm"
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-card-foreground">새 학습 기록</p>
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
          기록 추가
        </button>
      </div>
    </form>
  )
}
