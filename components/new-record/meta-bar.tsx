"use client"

import { Check, X } from "lucide-react"
import type { Category } from "@/lib/types"

export const studyTypes = ["강의 시청", "읽기", "문제풀이", "복습", "실습"] as const
export type NewStudyType = (typeof studyTypes)[number]

interface MetaBarProps {
  categories: Category[]
  categoryId: string
  subjectId: string
  studyType: NewStudyType
  canSave: boolean
  onChangeCategory: (id: string) => void
  onChangeSubject: (id: string) => void
  onChangeStudyType: (type: NewStudyType) => void
  onSave: () => void
  onCancel: () => void
}

export function MetaBar({
  categories,
  categoryId,
  subjectId,
  studyType,
  canSave,
  onChangeCategory,
  onChangeSubject,
  onChangeStudyType,
  onSave,
  onCancel,
}: MetaBarProps) {
  const activeCategory = categories.find((c) => c.id === categoryId)
  const subjects = activeCategory?.children ?? []

  return (
    <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex max-w-3xl flex-col gap-4 px-6 py-3 lg:px-10 xl:flex-row xl:items-center xl:justify-between">
        {/* Left: category + subject selects */}
        <div className="flex items-center gap-2">
          <select
            value={categoryId}
            onChange={(e) => onChangeCategory(e.target.value)}
            className="rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground shadow-sm outline-none transition-colors hover:bg-muted focus:ring-2 focus:ring-indigo-500"
            aria-label="카테고리 선택"
          >
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
          <span className="text-muted-foreground">/</span>
          <select
            value={subjectId}
            onChange={(e) => onChangeSubject(e.target.value)}
            disabled={subjects.length === 0}
            className="rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground shadow-sm outline-none transition-colors hover:bg-muted focus:ring-2 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="과목 선택"
          >
            {subjects.length === 0 ? (
              <option value="">과목 없음</option>
            ) : (
              subjects.map((sub) => (
                <option key={sub.id} value={sub.id}>
                  {sub.name}
                </option>
              ))
            )}
          </select>
        </div>

        {/* Center: study type chips */}
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="학습 유형">
          {studyTypes.map((type) => {
            const active = type === studyType
            return (
              <button
                key={type}
                type="button"
                onClick={() => onChangeStudyType(type)}
                aria-pressed={active}
                className={`rounded-full px-3 py-1.5 text-sm font-medium ring-1 ring-inset transition-colors ${
                  active
                    ? "bg-indigo-600 text-white ring-indigo-600"
                    : "bg-card text-muted-foreground ring-border hover:bg-muted"
                }`}
              >
                {type}
              </button>
            )
          })}
        </div>

        {/* Right: save + cancel */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            취소
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={!canSave}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none"
          >
            <Check className="size-4" />
            저장
          </button>
        </div>
      </div>
    </header>
  )
}

export { X }
