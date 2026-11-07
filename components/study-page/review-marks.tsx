"use client"

import { splitConcept } from "@/lib/study-pages"
import type { Judgment } from "@/lib/review"

// 복습 (D-34) inside the note: what a covered block shows, and the marks the user picks once it is opened.

export interface ReviewView {
  // Blocks being reviewed: 핵심 개념, a 오답 노트's wrong problems, or headings when the note has neither.
  items: Set<string>
  // Blocks under a heading item that isn't opened yet (they stay out of sight until then).
  covered: Set<string>
  opened: Record<string, boolean>
  marks: Record<string, Judgment>
  onOpen: (blockId: string) => void
  onMark: (blockId: string, judgment: Judgment) => void
}

const markTone: Record<Judgment, string> = {
  right: "bg-success-50 text-success-700",
  unsure: "bg-attention-50 text-attention-800",
  wrong: "bg-danger-50 text-danger-700",
}

// Small text marks at the end of a block, like the 맞힘 · 틀림 of a 오답 노트 problem.
export function ReviewMarks({
  value,
  onMark,
  labels = { right: "알았음", unsure: "헷갈림", wrong: "몰랐음" },
}: {
  value: Judgment | undefined
  onMark: (judgment: Judgment) => void
  labels?: Partial<Record<Judgment, string>>
}) {
  const options = (["right", "unsure", "wrong"] as const).filter((j) => labels[j])
  return (
    <span role="group" aria-label="떠올렸나요?" className="mt-0.5 flex shrink-0 gap-0.5">
      {options.map((j) => (
        <button
          key={j}
          type="button"
          aria-pressed={value === j}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={() => onMark(j)}
          className={`rounded px-1.5 py-0.5 text-xs font-medium transition-colors ${
            value === j ? markTone[j] : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          {labels[j]}
        </button>
      ))}
    </span>
  )
}

// A 핵심 개념 during review: the term stays, the explanation is covered until the user has tried to recall it.
export function ConceptReview({
  text,
  opened,
  mark,
  onOpen,
  onMark,
}: {
  text: string
  opened: boolean
  mark: Judgment | undefined
  onOpen: () => void
  onMark: (judgment: Judgment) => void
}) {
  const { term, detail } = splitConcept(text)
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1.5 py-0.5">
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 text-base font-semibold leading-relaxed text-foreground">{term ?? "이 핵심 개념"}</p>
        {opened && <ReviewMarks value={mark} onMark={onMark} />}
      </div>
      {opened ? (
        <p className="whitespace-pre-line text-base leading-relaxed text-foreground motion-safe:animate-in motion-safe:fade-in motion-safe:duration-150">
          {detail}
        </p>
      ) : (
        <button
          type="button"
          aria-expanded={false}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={onOpen}
          className="self-stretch rounded-md bg-action-100/70 px-3 py-1.5 text-left text-sm text-action-700 transition-colors hover:bg-action-100"
        >
          {term ? "뜻을 떠올려 보고 눌러서 맞춰 보기" : "무슨 내용이었는지 떠올려 보고 눌러서 보기"}
        </button>
      )}
    </div>
  )
}
