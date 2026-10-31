"use client"

import { useState, type ReactNode } from "react"
import Link from "next/link"
import { BookMarked, CalendarDays, FileText, ListChecks, X, type LucideIcon } from "lucide-react"
import { daysBetween, type AttachmentBlock, type PageKind, type PageProps } from "@/lib/study-pages"

// Fields the user types in (D-27): tags, plus a few per template. They live in the 속성 window (D-28); values
// computed from study records are shown there too, apart from these.

export const kindLabels: Record<PageKind, string> = {
  note: "학습 노트",
  lecture: "강의 노트",
  "wrong-answers": "오답 노트",
  exam: "시험 정리",
}

// "D-7" before the exam, "D-day" on it, null once it has passed or when unknown.
export function examCountdown(examDate: string | undefined, today: string | null) {
  if (!examDate || !today) return null
  const days = daysBetween(today, examDate)
  if (days < 0) return null
  return days === 0 ? "D-day" : `D-${days}`
}

const input =
  "w-full min-w-0 rounded-md bg-transparent px-1.5 py-1 text-sm text-foreground outline-none placeholder:text-muted-foreground/70 hover:bg-muted/60 focus:bg-muted"

export function TemplateFields({
  kind,
  props,
  onChangeProps,
  pdfs,
  scopeOptions,
  problems,
  retryHref,
  today,
}: {
  kind: PageKind | null
  props: PageProps
  onChangeProps: (patch: Partial<PageProps>) => void
  // 강의 노트: PDFs in the body that can be the lecture material.
  pdfs: AttachmentBlock[]
  // 시험 정리: notes that can be in the exam scope (same subject first).
  scopeOptions: { id: string; title: string }[]
  // 오답 노트: problems in the body and how many are still wrong.
  problems: { total: number; wrong: number }
  retryHref?: string
  today: string | null
}) {
  const countdown = kind === "exam" ? examCountdown(props.examDate, today) : null
  if (kind === "lecture")
    return (
      <>
        <PropertyRow icon={CalendarDays} label="주차" htmlFor="prop-week">
          <input
            id="prop-week"
            value={props.week ?? ""}
            onChange={(e) => onChangeProps({ week: e.target.value })}
            placeholder="예: 3주차"
            autoComplete="off"
            className={input}
          />
        </PropertyRow>
        <PropertyRow icon={FileText} label="강의 자료" htmlFor="prop-material">
          {pdfs.length > 0 ? (
            <select
              id="prop-material"
              value={props.materialBlockId ?? ""}
              onChange={(e) => onChangeProps({ materialBlockId: e.target.value || undefined })}
              className="max-w-full rounded-md bg-transparent px-1 py-1 text-sm text-foreground outline-none hover:bg-muted/60 focus:bg-muted"
            >
              <option value="">고르지 않음</option>
              {pdfs.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          ) : (
            <span className="px-1.5 text-xs text-muted-foreground">본문에 PDF를 올리면 여기서 고를 수 있어요</span>
          )}
        </PropertyRow>
      </>
    )
  if (kind === "wrong-answers")
    return (
      <>
        <PropertyRow icon={BookMarked} label="출처" htmlFor="prop-source">
          <input
            id="prop-source"
            value={props.source ?? ""}
            onChange={(e) => onChangeProps({ source: e.target.value })}
            placeholder="예: 2024 정보처리기사 실기 1회"
            autoComplete="off"
            className={input}
          />
        </PropertyRow>
        <PropertyRow icon={ListChecks} label="틀린 문제">
          {problems.total > 0 ? (
            <span className="inline-flex items-center gap-2 px-1.5">
              <span className="tabular-nums">
                {problems.wrong} / {problems.total}
              </span>
              {problems.wrong > 0 && retryHref && (
                <Link href={retryHref} className="rounded px-1.5 py-0.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-50">
                  다시 풀기
                </Link>
              )}
            </span>
          ) : (
            <span className="px-1.5 text-xs text-muted-foreground">토글 하나가 문제 하나예요</span>
          )}
        </PropertyRow>
      </>
    )
  if (kind === "exam")
    return (
      <>
        <PropertyRow icon={CalendarDays} label="시험일" htmlFor="prop-exam">
          <span className="inline-flex items-center gap-2">
            <input
              id="prop-exam"
              type="date"
              value={props.examDate ?? ""}
              onChange={(e) => onChangeProps({ examDate: e.target.value || undefined })}
              className="rounded-md bg-transparent px-1 py-1 text-sm text-foreground outline-none hover:bg-muted/60 focus:bg-muted"
            />
            {countdown && (
              <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-xs font-semibold text-indigo-700">{countdown}</span>
            )}
          </span>
        </PropertyRow>
        <PropertyRow icon={ListChecks} label="범위">
          <ScopePicker value={props.scope ?? []} options={scopeOptions} onChange={(scope) => onChangeProps({ scope })} />
        </PropertyRow>
      </>
    )
  return null
}

// Tag chips with an inline add field. Used at the end of the note and in the 속성 window.
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

function ScopePicker({
  value,
  options,
  onChange,
}: {
  value: string[]
  options: { id: string; title: string }[]
  onChange: (scope: string[]) => void
}) {
  const picked = value
    .map((id) => options.find((o) => o.id === id))
    .filter((o): o is { id: string; title: string } => o !== undefined)
  const rest = options.filter((o) => !value.includes(o.id))
  return (
    <span className="flex flex-wrap items-center gap-1 px-1">
      {picked.map((o) => (
        <span key={o.id} className="inline-flex items-center gap-0.5 rounded bg-muted px-1.5 py-0.5 text-xs text-foreground">
          {o.title || "제목 없음"}
          <button
            type="button"
            onClick={() => onChange(value.filter((id) => id !== o.id))}
            aria-label={`${o.title || "제목 없음"} 범위에서 빼기`}
            className="rounded text-muted-foreground hover:text-foreground"
          >
            <X className="size-3" />
          </button>
        </span>
      ))}
      {rest.length > 0 && (
        <select
          aria-label="범위에 노트 넣기"
          value=""
          onChange={(e) => e.target.value && onChange([...value, e.target.value])}
          className="rounded bg-transparent px-0.5 py-0.5 text-xs text-muted-foreground outline-none hover:bg-muted/60 focus:bg-muted"
        >
          <option value="">+ 노트 넣기</option>
          {rest.map((o) => (
            <option key={o.id} value={o.id}>
              {o.title || "제목 없음"}
            </option>
          ))}
        </select>
      )}
    </span>
  )
}

export function PropertyRow({
  icon: Icon,
  label,
  htmlFor,
  children,
}: {
  icon?: LucideIcon
  label: string
  htmlFor?: string
  children: ReactNode
}) {
  return (
    <div className="flex min-h-9 items-center gap-3 rounded-lg px-2.5 py-1 text-sm">
      <dt className="flex w-24 shrink-0 items-center gap-2 text-muted-foreground">
        {Icon && <Icon className="size-4" aria-hidden="true" />}
        {htmlFor ? <label htmlFor={htmlFor}>{label}</label> : label}
      </dt>
      <dd className="min-w-0 flex-1 text-foreground">{children}</dd>
    </div>
  )
}
