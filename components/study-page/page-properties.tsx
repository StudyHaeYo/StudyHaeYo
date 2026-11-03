"use client"

import { useState } from "react"
import { X } from "lucide-react"
import { daysBetween } from "@/lib/study-pages"

// What is left of the 속성 window (D-28 → D-30): the kind is the chip in the top bar, kind values sit at the top
// of the body (kind-head.tsx, exam-scope.tsx), and tags are at the end of the note.

// "D-7" before the exam, "D-day" on it, null once it has passed or when unknown.
export function examCountdown(examDate: string | undefined, today: string | null) {
  if (!examDate || !today) return null
  const days = daysBetween(today, examDate)
  if (days < 0) return null
  return days === 0 ? "D-day" : `D-${days}`
}

// Tag chips with an inline add field, at the end of the note (D-30).
export function TagEditor({ tags, onChange, size = "sm" }: { tags: string[]; onChange: (tags: string[]) => void; size?: "sm" | "md" }) {
  const [draft, setDraft] = useState("")
  const add = () => {
    const next = draft.trim().replace(/^#/, "")
    if (next && !tags.includes(next)) onChange([...tags, next])
    setDraft("")
  }
  const chip = size === "md" ? "px-2.5 py-1 text-[13px]" : "px-2 py-0.5 text-xs"
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      {tags.map((tag) => (
        <span key={tag} className={`group inline-flex items-center gap-0.5 rounded-full bg-muted text-foreground ${chip}`}>
          #{tag}
          <button
            type="button"
            onClick={() => onChange(tags.filter((t) => t !== tag))}
            aria-label={`${tag} 태그 삭제`}
            className="rounded-full text-muted-foreground opacity-0 transition-opacity hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100"
          >
            <X className="size-3" />
          </button>
        </span>
      ))}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.nativeEvent.isComposing || e.keyCode === 229) return
          if (e.key === "Enter") {
            e.preventDefault()
            add()
          }
        }}
        onBlur={add}
        aria-label="태그 추가"
        placeholder="+ 태그"
        autoComplete="off"
        className={`w-20 rounded-full border border-dashed border-border bg-transparent outline-none placeholder:text-muted-foreground/80 focus:border-indigo-300 focus:bg-background ${chip}`}
      />
    </span>
  )
}
