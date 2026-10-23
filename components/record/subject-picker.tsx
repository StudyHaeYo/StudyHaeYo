"use client"

import { useState } from "react"
import { Check, X } from "lucide-react"
import { addGroup, nodePath, useWorkspace } from "@/lib/workspace"

const NEW = "__new__"
const NONE = ""

export const pickerFieldClass =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-indigo-300 focus:ring-2 focus:ring-indigo-500/30"

// Subjects in sidebar order, labeled with the folders above them ("전공 공부 › 자료구조").
export function useSubjectOptions() {
  const workspace = useWorkspace()
  return workspace.groups
    .filter((g) => g.kind === "subject")
    .map((g) => ({
      id: g.id,
      name: g.name,
      label: [...nodePath(workspace, g.parentId).map((n) => n.name), g.name].join(" › "),
    }))
}

// One subject picker for the quick record, the timer and record edits. "+ 새 과목" makes a subject at the top
// of 내 페이지 and selects it, so nobody has to leave the form to set up the sidebar first.
export function SubjectPicker({
  value,
  onChange,
  noneLabel,
  id,
  autoFocus,
}: {
  value: string | null
  onChange: (subjectId: string | null) => void
  // When set, an empty choice with this label is offered (e.g. "과목 없이").
  noneLabel?: string
  id?: string
  autoFocus?: boolean
}) {
  const options = useSubjectOptions()
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState("")

  const create = () => {
    const trimmed = name.trim()
    if (!trimmed) return
    const existing = options.find((o) => o.name === trimmed)
    onChange(existing ? existing.id : addGroup(trimmed, null, "subject"))
    setAdding(false)
    setName("")
  }

  if (adding) {
    return (
      <div className="flex items-center gap-1.5">
        <input
          id={id}
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.nativeEvent.isComposing || e.keyCode === 229) return
            if (e.key === "Enter") {
              e.preventDefault()
              create()
            } else if (e.key === "Escape") {
              e.preventDefault()
              e.stopPropagation()
              setAdding(false)
            }
          }}
          placeholder="새 과목 이름 (예: 운영체제)"
          aria-label="새 과목 이름"
          className={pickerFieldClass}
        />
        <button
          type="button"
          onClick={create}
          disabled={!name.trim()}
          aria-label="과목 만들기"
          className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
        >
          <Check className="size-4" />
        </button>
        <button
          type="button"
          onClick={() => setAdding(false)}
          aria-label="취소"
          className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-accent"
        >
          <X className="size-4" />
        </button>
      </div>
    )
  }

  return (
    <select
      id={id}
      autoFocus={autoFocus}
      value={value ?? NONE}
      onChange={(e) => {
        if (e.target.value === NEW) setAdding(true)
        else onChange(e.target.value || null)
      }}
      className={pickerFieldClass}
    >
      {(noneLabel !== undefined || value === null) && <option value={NONE}>{noneLabel ?? "과목 선택"}</option>}
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          {o.label}
        </option>
      ))}
      <option value={NEW}>+ 새 과목</option>
    </select>
  )
}
