"use client"

import { useState, useSyncExternalStore, type ReactNode } from "react"
import { BookMarked, CalendarDays, ChevronDown, ChevronRight, FileText, Hash, ListChecks, X, type LucideIcon } from "lucide-react"
import { daysBetween, formatDate, type AttachmentBlock, type PageKind, type PageProps } from "@/lib/study-pages"

// Properties are what the user types in (D-27): tags, plus a few fields per template. Values computed from
// study records (status, understanding, time, next review) live in StudySummary above the records instead.

// Whether the inline properties are folded. Folded by default; one choice for every page, remembered per browser.
// The server and the hydration pass always see "folded", so markup matches; a saved "open" applies right after hydration.
const COLLAPSE_KEY = "studyhaeyo:page-properties-collapsed"
const COLLAPSE_EVENT = "studyhaeyo:page-properties-collapsed"
// Fallback when localStorage throws (private mode, blocked site data).
let memoryCollapsed: boolean | null = null

function subscribeCollapsed(onChange: () => void) {
  window.addEventListener(COLLAPSE_EVENT, onChange)
  window.addEventListener("storage", onChange)
  return () => {
    window.removeEventListener(COLLAPSE_EVENT, onChange)
    window.removeEventListener("storage", onChange)
  }
}

function readCollapsed() {
  try {
    return window.localStorage.getItem(COLLAPSE_KEY) !== "0"
  } catch {
    return true
  }
}

function setCollapsed(next: boolean) {
  try {
    window.localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0")
  } catch {
    // Storage blocked: the toggle still works until the next reload.
    memoryCollapsed = next
  }
  window.dispatchEvent(new Event(COLLAPSE_EVENT))
}

function getCollapsed() {
  return memoryCollapsed ?? readCollapsed()
}

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

interface PagePropertiesProps {
  kind: PageKind | null
  props: PageProps
  // False until workspace_nodes.props exists: only tags are shown.
  propsReady: boolean
  tags: string[]
  onChangeTags: (tags: string[]) => void
  onChangeProps: (patch: Partial<PageProps>) => void
  // 강의 노트: PDFs in the body that can be the lecture material.
  pdfs: AttachmentBlock[]
  // 시험 정리: notes that can be in the exam scope (same subject first).
  scopeOptions: { id: string; title: string }[]
  // 오답 노트: problems in the body and how many are still wrong.
  problems: { total: number; wrong: number }
  today: string | null
}

export function PageProperties({
  kind,
  props,
  propsReady,
  tags,
  onChangeTags,
  onChangeProps,
  pdfs,
  scopeOptions,
  problems,
  today,
}: PagePropertiesProps) {
  const [draft, setDraft] = useState("")
  const collapsed = useSyncExternalStore(subscribeCollapsed, getCollapsed, () => true)
  const fieldsOn = propsReady && kind !== null

  const addTag = () => {
    const next = draft.trim().replace(/^#/, "")
    if (next && !tags.includes(next)) onChangeTags([...tags, next])
    setDraft("")
  }

  const countdown = kind === "exam" ? examCountdown(props.examDate, today) : null
  const material = pdfs.find((p) => p.id === props.materialBlockId)
  const summary = [
    kind ? kindLabels[kind] : null,
    fieldsOn && kind === "lecture" && props.week ? props.week : null,
    fieldsOn && kind === "lecture" && material ? material.name : null,
    fieldsOn && kind === "wrong-answers" && problems.total > 0 ? `틀린 문제 ${problems.wrong} / ${problems.total}` : null,
    fieldsOn && kind === "exam" && props.examDate ? `${formatDate(props.examDate)}${countdown ? ` · ${countdown}` : ""}` : null,
    fieldsOn && kind === "exam" && props.scope?.length ? `범위 ${props.scope.length}개` : null,
    tags.length > 0 ? tags.map((t) => `#${t}`).join(" ") : null,
  ].filter(Boolean)

  const headerClass =
    "flex min-h-8 items-center gap-2 rounded-md px-2 py-1 text-left text-sm text-muted-foreground transition-colors hover:bg-muted/60"

  if (collapsed) {
    return (
      <section aria-label="페이지 속성" className="flex flex-col">
        <button type="button" onClick={() => setCollapsed(false)} aria-expanded={false} className={headerClass}>
          <ChevronRight className="size-4 shrink-0" aria-hidden="true" />
          <span className="shrink-0">속성</span>
          <span className="min-w-0 truncate text-xs text-muted-foreground/80">{summary.join(" · ") || "태그 추가"}</span>
        </button>
      </section>
    )
  }

  const input =
    "w-full min-w-0 rounded bg-transparent px-1 py-0.5 text-sm text-foreground outline-none placeholder:text-muted-foreground/70 focus:bg-muted"

  return (
    <section aria-label="페이지 속성" className="flex flex-col gap-0.5">
      <button type="button" onClick={() => setCollapsed(true)} aria-expanded={true} className={headerClass}>
        <ChevronDown className="size-4 shrink-0" aria-hidden="true" />
        속성
        <span className="text-xs text-muted-foreground/70">접기</span>
      </button>
      <dl className="flex flex-col">
        {fieldsOn && kind === "lecture" && (
          <>
            <Row icon={CalendarDays} label="주차" htmlFor="prop-week">
              <input
                id="prop-week"
                value={props.week ?? ""}
                onChange={(e) => onChangeProps({ week: e.target.value })}
                placeholder="예: 3주차"
                autoComplete="off"
                className={input}
              />
            </Row>
            <Row icon={FileText} label="강의 자료" htmlFor="prop-material">
              {pdfs.length > 0 ? (
                <select
                  id="prop-material"
                  value={props.materialBlockId ?? ""}
                  onChange={(e) => onChangeProps({ materialBlockId: e.target.value || undefined })}
                  className="max-w-full rounded bg-transparent px-0.5 py-0.5 text-sm text-foreground outline-none focus:bg-muted"
                >
                  <option value="">고르지 않음</option>
                  {pdfs.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="text-xs text-muted-foreground/80">본문에 PDF를 올리면 여기서 고를 수 있어요</span>
              )}
            </Row>
          </>
        )}
        {fieldsOn && kind === "wrong-answers" && (
          <>
            <Row icon={BookMarked} label="출처" htmlFor="prop-source">
              <input
                id="prop-source"
                value={props.source ?? ""}
                onChange={(e) => onChangeProps({ source: e.target.value })}
                placeholder="예: 2024 정보처리기사 실기 1회"
                autoComplete="off"
                className={input}
              />
            </Row>
            <Row icon={ListChecks} label="틀린 문제">
              {problems.total > 0 ? (
                <span className="tabular-nums">
                  {problems.wrong} / {problems.total}
                </span>
              ) : (
                <span className="text-xs text-muted-foreground/80">토글 하나가 문제 하나예요</span>
              )}
            </Row>
          </>
        )}
        {fieldsOn && kind === "exam" && (
          <>
            <Row icon={CalendarDays} label="시험일" htmlFor="prop-exam">
              <span className="inline-flex items-center gap-2">
                <input
                  id="prop-exam"
                  type="date"
                  value={props.examDate ?? ""}
                  onChange={(e) => onChangeProps({ examDate: e.target.value || undefined })}
                  className="rounded bg-transparent px-1 py-0.5 text-sm text-foreground outline-none focus:bg-muted"
                />
                {countdown && (
                  <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-xs font-medium text-indigo-700">{countdown}</span>
                )}
              </span>
            </Row>
            <Row icon={ListChecks} label="범위">
              <ScopePicker value={props.scope ?? []} options={scopeOptions} onChange={(scope) => onChangeProps({ scope })} />
            </Row>
          </>
        )}
        <Row icon={Hash} label="태그">
          <span className="flex flex-wrap items-center gap-1">
            {tags.map((tag) => (
              <span
                key={tag}
                className="group inline-flex items-center gap-0.5 rounded bg-muted px-1.5 py-0.5 text-xs text-foreground"
              >
                #{tag}
                <button
                  type="button"
                  onClick={() => onChangeTags(tags.filter((t) => t !== tag))}
                  aria-label={`${tag} 태그 삭제`}
                  className="rounded text-muted-foreground opacity-0 [@media(hover:none)]:opacity-100 transition-opacity hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
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
                  addTag()
                }
              }}
              onBlur={addTag}
              aria-label="태그 추가"
              placeholder={tags.length === 0 ? "태그 추가" : "+"}
              autoComplete="off"
              className="w-20 rounded bg-transparent px-1 py-0.5 text-xs outline-none placeholder:text-muted-foreground/70 focus:bg-muted"
            />
          </span>
        </Row>
      </dl>
    </section>
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
    <span className="flex flex-wrap items-center gap-1">
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
          className="rounded bg-transparent px-0.5 py-0.5 text-xs text-muted-foreground outline-none focus:bg-muted"
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

interface RowProps {
  icon: LucideIcon
  label: string
  htmlFor?: string
  children: ReactNode
}

function Row({ icon: Icon, label, htmlFor, children }: RowProps) {
  return (
    <div className="flex min-h-8 items-center gap-2 rounded-md px-2 py-1 text-sm transition-colors hover:bg-muted/60">
      <dt className="flex w-28 shrink-0 items-center gap-2 text-muted-foreground">
        <Icon className="size-4" aria-hidden="true" />
        {htmlFor ? <label htmlFor={htmlFor}>{label}</label> : label}
      </dt>
      <dd className="min-w-0 flex-1 text-foreground">{children}</dd>
    </div>
  )
}
