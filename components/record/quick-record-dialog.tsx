"use client"

import { useEffect, useId, useRef, useState, useSyncExternalStore, type FormEvent } from "react"
import { createPortal } from "react-dom"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { BookMarked, CalendarDays, Clock, FileText, Plus, Trash2, X } from "lucide-react"
import {
  addDays,
  formatDate,
  formatDuration,
  newRecordId,
  nextReviewDate,
  todayISO,
  type PageStudyRecord,
  type StudyRecordFields,
  type SubjectStudyRecord,
} from "@/lib/study-pages"
import {
  addPageRecord,
  addSubjectRecord,
  attachRecordToPage,
  deleteSubjectRecord,
  nearestSubject,
  updatePage,
  updateSubjectRecord,
  useSubjectRecordsReady,
  useWorkspace,
} from "@/lib/workspace"
import { recordShortcuts } from "@/lib/study-stats"
import { addTodo, useTodosStatus } from "@/lib/todos"
import { useFocusTrap } from "@/hooks/use-focus-trap"

// 학습 기록 창 (D-24, D-28). What was studied comes first; date · time · 이해도 are one row of buttons; where it goes
// (a note, a subject, or nothing = 과목 없음) is one optional search. The footer says what saving will do.
// Opened from everywhere ([+ 기록], a note, a subject, the timer, AI grading) and for editing any record.
export interface QuickRecordRequest {
  subjectId?: string | null
  pageId?: string | null
  minutes?: number
  studyContent?: string
  // Starting 이해도 (e.g. from an AI grading score).
  understanding?: number
  // Editing a record: one on a note stays on that note; one without a note can be moved anywhere.
  edit?: SubjectStudyRecord | PageStudyRecord
}

let current: (QuickRecordRequest & { token: number }) | null = null
const listeners = new Set<() => void>()
const emit = () => {
  for (const l of listeners) l()
}
const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}

export function openQuickRecord(request: QuickRecordRequest = {}) {
  current = { ...request, token: Date.now() }
  emit()
}

function closeQuickRecord() {
  current = null
  emit()
}

export function QuickRecordLayer() {
  const request = useSyncExternalStore(subscribe, () => current, () => null)
  if (!request) return null
  return createPortal(<QuickRecordDialog key={request.token} request={request} />, document.body)
}

type Target = { kind: "page"; id: string } | { kind: "subject"; id: string } | { kind: "none" }

const levelHints = ["거의 모르겠어요", "조금 이해했어요", "절반 정도 이해했어요", "대부분 이해했어요", "완벽히 이해했어요"]
const PRESETS = [25, 50, 90]

const isPageRecord = (r: SubjectStudyRecord | PageStudyRecord): r is PageStudyRecord => "pageId" in r

function initialTarget(request: QuickRecordRequest, ready: boolean): Target | null {
  const { edit } = request
  if (edit) {
    if (isPageRecord(edit)) return { kind: "page", id: edit.pageId }
    return edit.subjectId ? { kind: "subject", id: edit.subjectId } : { kind: "none" }
  }
  if (request.pageId) return { kind: "page", id: request.pageId }
  if (request.subjectId && ready) return { kind: "subject", id: request.subjectId }
  // Before the DB migration a record can only go on a note, so one has to be picked.
  return ready ? { kind: "none" } : null
}

function QuickRecordDialog({ request }: { request: QuickRecordRequest }) {
  const workspace = useWorkspace()
  const router = useRouter()
  const ready = useSubjectRecordsReady()
  const todosReady = useTodosStatus() === "ready"
  const edit = request.edit
  const today = todayISO()
  const dialogRef = useRef<HTMLFormElement>(null)
  const contentRef = useRef<HTMLTextAreaElement>(null)
  useFocusTrap(dialogRef)
  // Start typing right away with a mouse/keyboard; on a phone the keyboard would cover the sheet, so focus the sheet.
  useEffect(() => {
    if (window.matchMedia("(pointer: fine)").matches) contentRef.current?.focus()
    else dialogRef.current?.focus({ preventScroll: true })
  }, [])

  const [target, setTarget] = useState<Target | null>(() => initialTarget(request, ready))
  const [date, setDate] = useState(() => edit?.date ?? today)
  const [duration, setDuration] = useState(edit ? String(edit.durationMinutes) : request.minutes ? String(request.minutes) : "")
  const [understanding, setUnderstanding] = useState<number | null>(edit?.understanding ?? request.understanding ?? null)
  const [studyContent, setStudyContent] = useState(edit?.studyContent ?? request.studyContent ?? "")
  const [difficulties, setDifficulties] = useState(edit?.difficulties ?? "")
  const [nextSteps, setNextSteps] = useState(edit?.nextSteps ?? "")
  const [showHard, setShowHard] = useState(Boolean(edit?.difficulties))
  const [showNext, setShowNext] = useState(Boolean(edit?.nextSteps))
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeQuickRecord()
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [])

  const page = target?.kind === "page" ? workspace.pages.find((p) => p.id === target.id) : undefined
  const subject = target?.kind === "subject" ? workspace.groups.find((g) => g.id === target.id) : undefined
  const minutes = Number.parseInt(duration, 10)
  const minutesOk = Number.isFinite(minutes) && minutes > 0
  const validTarget = target !== null && (target.kind === "none" ? ready : target.kind === "page" ? !!page : !!subject && ready)
  const canSubmit = validTarget && minutesOk && understanding !== null && date <= today

  const shortcuts = edit || request.studyContent || request.pageId ? null : recordShortcuts(workspace)
  const usableShortcuts = (shortcuts?.items ?? []).filter((s) =>
    s.pageId ? workspace.pages.some((p) => p.id === s.pageId) : s.subjectId ? ready && workspace.groups.some((g) => g.id === s.subjectId) : ready,
  )

  // What saving will do, in words — or what is still missing.
  const missing = !validTarget
    ? ready
      ? "어디에 남길지 다시 골라 주세요."
      : "지금은 노트를 골라야 저장돼요."
    : !minutesOk
      ? "공부한 시간을 적어 주세요."
      : understanding === null
        ? "이해도를 골라 주세요."
        : date > today
          ? "앞으로의 날짜에는 남길 수 없어요."
          : null
  const result = page
    ? (
        <>
          <b className="font-semibold text-foreground">{page.title || "제목 없음"}</b>에 남아요
          {understanding !== null && (
            <>
              {" · "}다음 복습 <b className="font-semibold text-emerald-700">{formatDate(nextReviewDate(date, understanding))}</b>
            </>
          )}
        </>
      )
    : subject
      ? (
          <>
            <b className="font-semibold text-foreground">{subject.name}</b> 과목에 남아요 · 노트가 없어 복습일은 안 생겨요
          </>
        )
      : "과목 없이 남아요 · 나중에 학습 기록에서 노트에 연결할 수 있어요"

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!canSubmit || understanding === null || !target) return
    const fields: StudyRecordFields = {
      id: edit?.id ?? newRecordId(),
      date,
      createdAt: edit ? edit.createdAt : Date.now(),
      durationMinutes: minutes,
      understanding,
      studyContent: studyContent.trim(),
      difficulties: showHard ? difficulties.trim() : "",
      nextSteps: showNext ? nextSteps.trim() : "",
      tags: edit?.tags ?? [],
    }
    let href = "/records"
    if (target.kind === "page" && page) {
      if (edit && isPageRecord(edit))
        updatePage(page.id, (p) => ({ ...p, studyRecords: p.studyRecords.map((r) => (r.id === fields.id ? { ...fields, pageId: page.id } : r)) }))
      else if (edit) attachRecordToPage({ ...fields, subjectId: edit.subjectId }, page.id)
      else addPageRecord(page.id, { ...fields, pageId: page.id })
      href = `/record/${page.id}`
    } else {
      const record: SubjectStudyRecord = { ...fields, subjectId: target.kind === "subject" ? target.id : null }
      if (edit) updateSubjectRecord(record)
      else addSubjectRecord(record)
      if (record.subjectId) href = `/subject/${record.subjectId}`
    }
    closeQuickRecord()
    const review = nextReviewDate(date, understanding)
    // Saved from the note itself: "보기" would go nowhere, so offer to put the review on that day's checklist.
    const here = typeof window !== "undefined" && window.location.pathname === href
    toast.success(edit ? "기록을 고쳤어요" : "기록했어요", {
      description: page ? `다음 복습은 ${formatDate(review)}이에요.` : undefined,
      action:
        page && here && todosReady && !edit
          ? { label: "그날 할 일에 추가", onClick: () => addTodo(`${page.title || "제목 없음"} 복습`, review) }
          : here
            ? undefined
            : { label: "보기", onClick: () => router.push(href) },
    })
  }

  const remove = () => {
    if (!edit) return
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }
    if (isPageRecord(edit))
      updatePage(edit.pageId, (p) => ({ ...p, studyRecords: p.studyRecords.filter((r) => r.id !== edit.id) }))
    else deleteSubjectRecord(edit.id)
    closeQuickRecord()
    toast.success("기록을 삭제했어요")
  }

  const pill =
    "relative inline-flex h-9 items-center gap-2 rounded-xl border border-border bg-background px-3 text-sm text-foreground transition-colors focus-within:border-indigo-400 focus-within:ring-4 focus-within:ring-indigo-50"
  const chip = "rounded-full px-2.5 py-1 text-xs transition-colors"

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/30 sm:items-center sm:p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) closeQuickRecord()
      }}
    >
      <form
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="quick-record-title"
        tabIndex={-1}
        onSubmit={submit}
        className="flex max-h-[92dvh] w-full max-w-xl flex-col overflow-y-auto overscroll-contain rounded-t-3xl bg-card shadow-2xl outline-none sm:rounded-2xl"
      >
        <div className="mx-auto mt-2.5 h-1 w-9 rounded-full bg-border sm:hidden" aria-hidden="true" />
        <div className="flex items-center justify-between px-5 pt-3 sm:pt-4">
          <h2 id="quick-record-title" className="text-sm font-semibold text-foreground">
            {edit ? "학습 기록 고치기" : "학습 기록 남기기"}
          </h2>
          <button
            type="button"
            onClick={closeQuickRecord}
            aria-label="닫기"
            className="-mr-2 flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        {usableShortcuts.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 px-5 pt-3">
            <span className="mr-0.5 text-xs text-muted-foreground">{shortcuts?.repeated ? "자주 남긴 기록" : "최근 기록"}</span>
            {usableShortcuts.map((s) => (
              <button
                key={`${s.pageId}|${s.subjectId}|${s.studyContent}`}
                type="button"
                onClick={() => {
                  setStudyContent(s.studyContent)
                  setDuration(String(s.durationMinutes))
                  setTarget(s.pageId ? { kind: "page", id: s.pageId } : s.subjectId ? { kind: "subject", id: s.subjectId } : { kind: "none" })
                }}
                className="inline-flex max-w-full items-center gap-1 rounded-full bg-muted px-3 py-1.5 text-xs text-foreground transition-colors hover:bg-indigo-50 hover:text-indigo-700"
              >
                <span className="truncate">{s.studyContent.split("\n")[0].slice(0, 18)}</span>
                <span className="shrink-0 text-muted-foreground">· {formatDuration(s.durationMinutes)}</span>
              </button>
            ))}
          </div>
        )}

        <label htmlFor="qr-content" className="sr-only">
          무엇을 공부했나요
        </label>
        <textarea
          id="qr-content"
          ref={contentRef}
          autoComplete="off"
          value={studyContent}
          onChange={(e) => setStudyContent(e.target.value)}
          rows={2}
          placeholder="무엇을 공부했나요?"
          className="w-full resize-none bg-transparent px-5 pb-2 pt-3 text-lg font-semibold leading-snug text-foreground outline-none [field-sizing:content] placeholder:font-medium placeholder:text-muted-foreground/60 sm:text-xl"
        />

        <div className="flex flex-wrap gap-2 px-5">
          <label className={`${pill} cursor-pointer`}>
            <CalendarDays className="size-4 text-muted-foreground" aria-hidden="true" />
            {date === today ? "오늘" : date === addDays(today, -1) ? "어제" : formatDate(date)}
            <input
              type="date"
              aria-label="공부한 날짜"
              value={date}
              max={today}
              onChange={(e) => e.target.value && setDate(e.target.value)}
              onClick={(e) => e.currentTarget.showPicker?.()}
              className="absolute inset-0 cursor-pointer opacity-0"
            />
          </label>
          <label className={pill}>
            <Clock className="size-4 text-muted-foreground" aria-hidden="true" />
            <input
              type="number"
              inputMode="numeric"
              min={1}
              aria-label="공부한 시간(분)"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              placeholder="50"
              className="w-10 bg-transparent text-right tabular-nums outline-none placeholder:text-muted-foreground/60 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
            />
            분
          </label>
          <div className={pill} role="radiogroup" aria-label="이해도">
            <span className="text-muted-foreground">이해도</span>
            <span className="flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={understanding === n}
                  aria-label={`${n}점 - ${levelHints[n - 1]}`}
                  title={levelHints[n - 1]}
                  onClick={() => setUnderstanding(n)}
                  className={`flex size-6 items-center justify-center rounded-md text-xs font-semibold transition-colors ${
                    understanding !== null && n <= understanding
                      ? "bg-indigo-600 text-white"
                      : "border border-indigo-200 text-muted-foreground hover:border-indigo-400 hover:text-indigo-700"
                  }`}
                >
                  {n}
                </button>
              ))}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 px-5 pt-2">
          {[...(request.minutes && !PRESETS.includes(request.minutes) ? [request.minutes] : []), ...PRESETS].map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setDuration(String(m))}
              className={`${chip} ${String(m) === duration ? "bg-indigo-50 font-semibold text-indigo-700" : "bg-muted text-muted-foreground hover:text-foreground"}`}
            >
              {m === request.minutes && !edit ? `세션 ${formatDuration(m)}` : formatDuration(m)}
            </button>
          ))}
        </div>

        <div className="px-5 pt-4">
          <p id="qr-where-label" className="mb-1.5 text-xs text-muted-foreground">
            어디에 남길까요 <span className="text-muted-foreground/70">· {ready ? "선택" : "노트"}</span>
          </p>
          <WherePicker
            value={target}
            onChange={setTarget}
            ready={ready}
            locked={Boolean(edit && isPageRecord(edit))}
            preferPageId={request.pageId ?? null}
            labelledBy="qr-where-label"
          />
        </div>

        <div className="flex flex-col gap-2 px-5 pt-3">
          {showHard && (
            <textarea
              aria-label="어려웠던 점"
              autoFocus={!edit}
              value={difficulties}
              onChange={(e) => setDifficulties(e.target.value)}
              rows={1}
              placeholder="어려웠던 점"
              className="w-full resize-none rounded-xl border border-amber-200 bg-amber-50/60 px-3 py-2 text-sm text-foreground outline-none [field-sizing:content] placeholder:text-amber-700/60 focus:border-amber-400"
            />
          )}
          {showNext && (
            <textarea
              aria-label="다음에 할 일"
              autoFocus={!edit && !showHard}
              value={nextSteps}
              onChange={(e) => setNextSteps(e.target.value)}
              rows={1}
              placeholder="다음에 할 일"
              className="w-full resize-none rounded-xl border border-border px-3 py-2 text-sm text-foreground outline-none [field-sizing:content] placeholder:text-muted-foreground/70 focus:border-indigo-400"
            />
          )}
          {(!showHard || !showNext) && (
            <div className="flex gap-1.5">
              {!showHard && (
                <button type="button" onClick={() => setShowHard(true)} className={`${chip} inline-flex items-center gap-1 border border-dashed border-border text-muted-foreground hover:text-foreground`}>
                  <Plus className="size-3" aria-hidden="true" />
                  어려웠던 점
                </button>
              )}
              {!showNext && (
                <button type="button" onClick={() => setShowNext(true)} className={`${chip} inline-flex items-center gap-1 border border-dashed border-border text-muted-foreground hover:text-foreground`}>
                  <Plus className="size-3" aria-hidden="true" />
                  다음에 할 일
                </button>
              )}
            </div>
          )}
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-border bg-muted/30 px-5 py-3.5 sm:flex-nowrap">
          <p role="status" className="min-w-0 flex-1 basis-full text-[13px] leading-relaxed text-muted-foreground sm:basis-auto">
            {missing ?? result}
          </p>
          {edit && (
            <button
              type="button"
              onClick={remove}
              className="inline-flex h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
            >
              <Trash2 className="size-4" aria-hidden="true" />
              {confirmDelete ? "한 번 더 누르면 삭제" : "삭제"}
            </button>
          )}
          <button
            type="submit"
            disabled={!canSubmit}
            className="h-10 flex-1 rounded-xl bg-indigo-600 px-5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40 sm:flex-none"
          >
            {edit ? "저장" : "기록 남기기"}
          </button>
        </div>
      </form>
    </div>
  )
}

type Option = { target: Target; label: string; hint: string; group: string }

// One search for where the record goes: notes, subjects, or nothing (과목 없음).
function WherePicker({
  value,
  onChange,
  ready,
  locked,
  preferPageId,
  labelledBy,
}: {
  value: Target | null
  onChange: (target: Target | null) => void
  ready: boolean
  locked: boolean
  preferPageId: string | null
  labelledBy: string
}) {
  const workspace = useWorkspace()
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const listId = useId()
  const q = query.trim().toLowerCase()
  const matches = (s: string) => s.toLowerCase().includes(q)

  const lastStudied = (id: string) =>
    workspace.pages.find((p) => p.id === id)?.studyRecords.reduce((max, r) => (r.date > max ? r.date : max), "") ?? ""
  const pages = q
    ? workspace.pages.filter((p) => matches(p.title || "제목 없음")).slice(0, 8)
    : [...workspace.pages]
        .sort((a, b) => Number(b.id === preferPageId) - Number(a.id === preferPageId) || lastStudied(b.id).localeCompare(lastStudied(a.id)))
        .slice(0, 5)
  const subjects = ready ? workspace.groups.filter((g) => g.kind === "subject" && (!q || matches(g.name))).slice(0, 6) : []
  const options: Option[] = [
    ...pages.map((p) => ({
      target: { kind: "page" as const, id: p.id },
      label: p.title || "제목 없음",
      hint: (p.id === preferPageId ? "지금 보던 노트" : nearestSubject(workspace, p.parentId)?.name) ?? "",
      group: "노트",
    })),
    ...subjects.map((g) => ({ target: { kind: "subject" as const, id: g.id }, label: g.name, hint: "노트 없이 과목에만", group: "과목" })),
    ...(ready && !q ? [{ target: { kind: "none" as const }, label: "연결 안 함", hint: "과목 없이 남아요", group: "" }] : []),
  ]

  const pick = (option: Option) => {
    onChange(option.target)
    setQuery("")
    setOpen(false)
  }

  const page = value?.kind === "page" ? workspace.pages.find((p) => p.id === value.id) : undefined
  const subject = value?.kind === "subject" ? workspace.groups.find((g) => g.id === value.id) : undefined
  const token = page ? (
    <>
      <FileText className="size-3.5" aria-hidden="true" />
      <span className="truncate">{page.title || "제목 없음"}</span>
      {nearestSubject(workspace, page.parentId) && (
        <span className="shrink-0 font-normal text-indigo-700/70">{nearestSubject(workspace, page.parentId)?.name}</span>
      )}
    </>
  ) : subject ? (
    <>
      <BookMarked className="size-3.5" aria-hidden="true" />
      <span className="truncate">{subject.name}</span>
      <span className="shrink-0 font-normal text-indigo-700/70">과목</span>
    </>
  ) : null

  return (
    <div className="relative">
      <div className="flex min-h-11 items-center gap-2 rounded-xl border border-border bg-background px-2 py-1.5 focus-within:border-indigo-400 focus-within:ring-4 focus-within:ring-indigo-50">
        {token && (
          <span className="inline-flex h-7 min-w-0 max-w-full items-center gap-1.5 rounded-lg bg-indigo-50 pl-2.5 pr-1 text-sm font-semibold text-indigo-700">
            {token}
            {!locked && (
              <button
                type="button"
                aria-label="선택 지우기"
                onClick={() => onChange(ready ? { kind: "none" } : null)}
                className="flex size-5 shrink-0 items-center justify-center rounded text-indigo-700/70 hover:bg-indigo-100 hover:text-indigo-700"
              >
                <X className="size-3.5" />
              </button>
            )}
          </span>
        )}
        {locked ? (
          <span className="text-xs text-muted-foreground">노트에 남긴 기록이에요</span>
        ) : (
          <input
            role="combobox"
            aria-labelledby={labelledBy}
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={open && options[active] ? `${listId}-${active}` : undefined}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setActive(0)
              setOpen(true)
            }}
            onFocus={() => setOpen(true)}
            onClick={() => setOpen(true)}
            onBlur={() => setOpen(false)}
            onKeyDown={(e) => {
              if (e.nativeEvent.isComposing || e.keyCode === 229) return
              if (e.key === "ArrowDown") {
                e.preventDefault()
                setOpen(true)
                setActive((i) => Math.min(i + 1, options.length - 1))
              } else if (e.key === "ArrowUp") {
                e.preventDefault()
                setActive((i) => Math.max(i - 1, 0))
              } else if (e.key === "Enter" && open && options[active]) {
                e.preventDefault()
                pick(options[active])
              } else if (e.key === "Escape" && open) {
                e.stopPropagation()
                setOpen(false)
              } else if (e.key === "Backspace" && !query && token) {
                onChange(ready ? { kind: "none" } : null)
              }
            }}
            autoComplete="off"
            placeholder={token ? "" : ready ? "노트나 과목 찾기… 안 고르면 과목 없이 남아요" : "노트 찾기…"}
            className="min-w-24 flex-1 bg-transparent px-1 text-sm text-foreground outline-none placeholder:text-muted-foreground/70"
          />
        )}
      </div>
      {open && !locked && (
        <ul
          id={listId}
          role="listbox"
          aria-labelledby={labelledBy}
          className="absolute inset-x-0 top-full z-10 mt-1.5 max-h-64 overflow-y-auto rounded-2xl border border-border bg-popover p-1.5 shadow-xl"
        >
          {options.length === 0 && <li className="px-3 py-2 text-sm text-muted-foreground">맞는 노트나 과목이 없어요.</li>}
          {options.map((option, i) => (
            <li key={`${option.group}-${option.target.kind}-${"id" in option.target ? option.target.id : ""}`} role="presentation">
              {option.group && options[i - 1]?.group !== option.group && (
                <p className="px-2.5 pb-1 pt-2 text-[11px] text-muted-foreground">{option.group}</p>
              )}
              <div
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => {
                  e.preventDefault()
                  pick(option)
                }}
                onMouseEnter={() => setActive(i)}
                className={`flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-sm ${
                  i === active ? "bg-indigo-50 text-indigo-900" : "text-foreground"
                } ${option.target.kind === "none" ? "mt-1 border-t border-border text-muted-foreground" : ""}`}
              >
                {option.target.kind === "page" ? (
                  <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                ) : option.target.kind === "subject" ? (
                  <BookMarked className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                ) : null}
                <span className="truncate">{option.label}</span>
                <span className="ml-auto shrink-0 text-xs text-muted-foreground">{option.hint}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
