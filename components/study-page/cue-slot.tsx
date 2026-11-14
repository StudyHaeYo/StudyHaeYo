"use client"

import { useEffect, useRef } from "react"
import type { BlockType } from "@/lib/study-pages"

// 강의 노트 = 코넬 노트 (D-35): a block's cue (a question or keyword) sits in the page's left margin, outside the text
// column, so the notes keep their width. Where the margin is too narrow (the PDF or AI pane is open, a small screen)
// the cue goes above its block instead. The width is read from the page (`@container/page` on the note's outer box);
// Tailwind finds classes by their full name, so the variant is written out in each class.
//
// Needed margin: the cue (10rem) + the gap to the block handle (1.75rem) beside a 48rem article with 2.5rem padding:
// (W - 48rem) / 2 + 2.5rem >= 11.75rem → W >= 66.5rem.
//
// In the margin the cue floats with a negative margin as wide as itself plus the gap, so it takes no room from the
// block's lines, and the block's row (`flow-root`, see `cueRow`) grows when a cue runs longer than its block: two
// short lines with long cues never overlap.
export const cueRow = "@min-[66.5rem]/page:flow-root"

// Lines a cue up with the first line of its block (headings have room above their text). "cover": the gray line
// standing in for the block during review.
type CueAt = BlockType | "cover"
const cueTop: Partial<Record<CueAt, string>> = {
  h1: "@min-[66.5rem]/page:mt-[22px]",
  h2: "@min-[66.5rem]/page:mt-[16px]",
  h3: "@min-[66.5rem]/page:mt-[7px]",
  callout: "@min-[66.5rem]/page:mt-[13px]",
  code: "@min-[66.5rem]/page:mt-[11px]",
  cover: "@min-[66.5rem]/page:mt-[4px]",
}
const place =
  "@min-[66.5rem]/page:float-left @min-[66.5rem]/page:-ml-[11.75rem] @min-[66.5rem]/page:mb-0 @min-[66.5rem]/page:w-40 @min-[66.5rem]/page:text-right"

export function CueSlot({
  cue,
  type,
  editing,
  readOnly,
  onEdit,
  onChange,
  onDone,
}: {
  cue: string | undefined
  type: CueAt
  editing: boolean
  readOnly: boolean
  onEdit: () => void
  onChange: (cue: string) => void
  onDone: () => void
}) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    if (editing) ref.current?.focus()
  }, [editing])
  const top = cueTop[type] ?? "@min-[66.5rem]/page:mt-[3px]"
  const text = cue?.trim() ?? ""

  if (editing)
    return (
      <textarea
        ref={ref}
        value={cue ?? ""}
        rows={1}
        maxLength={80}
        spellCheck={false}
        aria-label="질문 (키워드도 돼요)"
        placeholder="질문이나 키워드…"
        onMouseDown={(e) => e.stopPropagation()}
        onChange={(e) => onChange(e.target.value.replace(/\n/g, " "))}
        onBlur={onDone}
        onKeyDown={(e) => {
          if (e.nativeEvent.isComposing || e.keyCode === 229) return
          if (e.key === "Enter" || e.key === "Escape") {
            e.preventDefault()
            onDone()
          }
        }}
        className={`mb-0.5 block w-full resize-none break-words bg-transparent text-sm font-semibold leading-snug text-foreground outline-none [field-sizing:content] placeholder:font-normal placeholder:text-muted-foreground/70 ${place} ${top}`}
      />
    )
  if (text)
    return readOnly ? (
      <p title={text} className={`mb-0.5 line-clamp-3 break-words text-sm font-semibold leading-snug text-foreground ${place} ${top}`}>
        {text}
      </p>
    ) : (
      // No `block` here: line-clamp sets its own display, and `block` would undo the clamp.
      <button
        type="button"
        title={text}
        aria-label={`질문 고치기: ${text}`}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={onEdit}
        className={`mb-0.5 line-clamp-3 break-words rounded text-left text-sm font-semibold leading-snug text-foreground hover:bg-accent ${place} ${top}`}
      >
        {text}
      </button>
    )
  if (readOnly) return null
  // No cue yet: a quiet "+ 질문" in the margin while the pointer is on the line (phones use the block menu instead).
  return (
    <button
      type="button"
      aria-label="질문 달기"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={onEdit}
      className={`hidden rounded text-sm text-muted-foreground opacity-0 transition-opacity hover:text-foreground focus-visible:opacity-100 group-hover/block:opacity-100 @min-[66.5rem]/page:block ${place} ${top}`}
    >
      + 질문
    </button>
  )
}

// The thin line that ties a block to its cue when the cue sits above the block (narrow page): it runs down the left
// edge of both. In the wide margin the 질문 band already lines the cue up with its block, so the line is hidden there.
export function CueLine() {
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute -left-2 bottom-1 top-1 w-0.5 rounded-full bg-action-300 @min-[66.5rem]/page:hidden"
    />
  )
}
