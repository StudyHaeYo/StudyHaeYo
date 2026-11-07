"use client"

import { splitConcept } from "@/lib/study-pages"
import type { Judgment, ReviewItem } from "@/lib/review"

// 복습 (D-34) inside the note: a covered part reads as a quiet gray line, and the marks are small words at the end of
// the line, so the note still looks like the note.

export interface ReviewView {
  items: Map<string, ReviewItem>
  // Blocks under a heading that isn't opened yet; they stay out of sight until then.
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

export function ReviewMarks({
  value,
  onMark,
  labels = { right: "알았음", unsure: "헷갈림", wrong: "몰랐음" },
  className = "mt-0.5",
}: {
  value: Judgment | undefined
  onMark: (judgment: Judgment) => void
  labels?: Partial<Record<Judgment, string>>
  // The top offset that centers the marks on the block's first line (a heading has padding above its text).
  className?: string
}) {
  const options = (["right", "unsure", "wrong"] as const).filter((j) => labels[j])
  return (
    <span role="group" aria-label="떠올렸나요?" className={`flex shrink-0 gap-0.5 print:hidden ${className}`}>
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

// The gray line standing in for what is covered. Pressing it opens the answer. The words stay short because the line
// under the title already says to recall first; `name` tells a screen reader what opens.
export function Cover({
  label = "눌러서 보기",
  name,
  onOpen,
  className = "py-1",
}: {
  label?: string
  name: string
  onOpen: () => void
  className?: string
}) {
  return (
    <button
      type="button"
      aria-expanded={false}
      aria-label={`${name} · ${label}`}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={onOpen}
      className={`block w-full rounded-md bg-muted px-3 text-left text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground ${className}`}
    >
      {label}
    </button>
  )
}

// A 핵심 개념 or a paragraph during review: its cue stays (the term, or the first words), the rest is covered.
export function CoveredText({
  text,
  cue,
  opened,
  mark,
  onOpen,
  onMark,
  className,
}: {
  text: string
  cue: string
  opened: boolean
  mark: Judgment | undefined
  onOpen: () => void
  onMark: (judgment: Judgment) => void
  className: string
}) {
  const { term } = splitConcept(text)
  return (
    // On a phone the marks go under the text so it keeps the full width.
    <div className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
      <div className={`min-w-0 flex-1 ${className}`}>
        {opened ? (
          <p className="whitespace-pre-line break-words motion-safe:animate-in motion-safe:fade-in motion-safe:duration-150">{text}</p>
        ) : (
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className={term === cue ? "font-semibold" : ""}>
              {cue}
              {term === cue ? ":" : ""}
            </span>
            <Cover name={cue} onOpen={onOpen} className="!inline-block !w-auto flex-1 py-0.5" />
          </div>
        )}
      </div>
      {opened && <ReviewMarks value={mark} onMark={onMark} />}
    </div>
  )
}
