"use client"

import { useEffect, useState, useSyncExternalStore, type FormEvent } from "react"
import { createPortal } from "react-dom"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { ChevronDown, FileText, NotebookPen, Trash2, X } from "lucide-react"
import { UnderstandingRating } from "@/components/record/understanding-rating"
import { SubjectPicker, pickerFieldClass } from "@/components/record/subject-picker"
import { newRecordId, todayISO, type StudyRecordFields, type SubjectStudyRecord } from "@/lib/study-pages"
import {
  addPageRecord,
  addSubjectRecord,
  attachRecordToPage,
  deleteSubjectRecord,
  descendantPages,
  nearestSubject,
  updateSubjectRecord,
  useSubjectRecordsReady,
  useWorkspace,
} from "@/lib/workspace"

// 학습 기록 창 (D-24): a study session belongs to a subject; linking it to a note is optional and is what gives
// that note a review date. Opened from the sidebar, the phone top bar, a subject page and the timer summary
// (subject first, note folded away), and from a note (AI grading) with that note fixed.
export interface QuickRecordRequest {
  subjectId?: string | null
  pageId?: string | null
  minutes?: number
  studyContent?: string
  // Starting 이해도 (e.g. from an AI grading score).
  understanding?: number
  // Editing a record left on a subject (it can be moved onto a page here).
  edit?: SubjectStudyRecord
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

const NO_PAGE = ""

function QuickRecordDialog({ request }: { request: QuickRecordRequest }) {
  const workspace = useWorkspace()
  const router = useRouter()
  const subjectRecordsReady = useSubjectRecordsReady()
  const edit = request.edit
  // Opened from a note: the record goes there, nothing to pick.
  const fixedPage = !edit && request.pageId ? workspace.pages.find((p) => p.id === request.pageId) : undefined

  const [subjectId, setSubjectId] = useState<string | null>(edit?.subjectId ?? request.subjectId ?? null)
  const [pageId, setPageId] = useState<string>(NO_PAGE)
  // Before the DB migration a record can only go on a note, so the note field starts open (and is required).
  const needsPage = !subjectRecordsReady
  const [linkOpen, setLinkOpen] = useState(needsPage)
  const [date, setDate] = useState(() => edit?.date ?? todayISO())
  const [duration, setDuration] = useState(
    edit ? String(edit.durationMinutes) : request.minutes ? String(request.minutes) : "",
  )
  const [understanding, setUnderstanding] = useState<number | null>(edit?.understanding ?? request.understanding ?? null)
  const [studyContent, setStudyContent] = useState(edit?.studyContent ?? request.studyContent ?? "")
  const [difficulties, setDifficulties] = useState(edit?.difficulties ?? "")
  const [nextSteps, setNextSteps] = useState(edit?.nextSteps ?? "")
  const [more, setMore] = useState(Boolean(edit?.difficulties || edit?.nextSteps))

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeQuickRecord()
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [])

  // Notes to link: the subject's notes (before the migration with no subject picked, every note).
  const pages = subjectId ? descendantPages(workspace, subjectId) : needsPage ? workspace.pages : []
  const linked = fixedPage ?? (pageId ? workspace.pages.find((p) => p.id === pageId) : undefined)
  const subjectName = (id: string | null) => workspace.groups.find((g) => g.id === id)?.name
  const linkedSubject = linked ? nearestSubject(workspace, linked.parentId) : null
  const minutes = Number.parseInt(duration, 10)
  const hasTarget = linked !== undefined || (subjectId !== null && !needsPage)
  const canSubmit = hasTarget && Number.isFinite(minutes) && minutes > 0 && understanding !== null && date <= todayISO()

  // Where this record will show up, in words.
  const destination = linked
    ? `${linkedSubject ? `${linkedSubject.name} · ` : ""}“${linked.title || "제목 없음"}” 노트에 기록돼요. 이 노트의 복습일이 잡혀요.`
    : subjectId
      ? needsPage
        ? "지금은 노트를 골라야 저장돼요."
        : `${subjectName(subjectId)} 과목의 학습 기록으로 남아요. 노트가 없어서 복습일은 생기지 않아요.`
      : null

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!canSubmit || understanding === null) return
    const fields: StudyRecordFields = {
      id: edit?.id ?? newRecordId(),
      date,
      createdAt: edit ? edit.createdAt : Date.now(),
      durationMinutes: minutes,
      understanding,
      studyContent: studyContent.trim(),
      difficulties: difficulties.trim(),
      nextSteps: nextSteps.trim(),
      tags: edit?.tags ?? [],
    }
    let href: string
    if (linked) {
      if (edit) attachRecordToPage({ ...fields, subjectId: edit.subjectId }, linked.id)
      else addPageRecord(linked.id, { ...fields, pageId: linked.id })
      href = `/record/${linked.id}`
    } else {
      const record = { ...fields, subjectId: subjectId! }
      if (edit) updateSubjectRecord(record)
      else addSubjectRecord(record)
      href = `/subject/${subjectId}`
    }
    closeQuickRecord()
    toast.success(edit ? (linked ? "기록을 노트에 연결했어요" : "기록을 고쳤어요") : "기록했어요", {
      action: { label: "보기", onClick: () => router.push(href) },
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/30 sm:items-center sm:p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) closeQuickRecord()
      }}
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="quick-record-title"
        onSubmit={submit}
        className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-y-auto rounded-t-2xl border border-border bg-card shadow-xl sm:rounded-xl"
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <h2 id="quick-record-title" className="inline-flex items-center gap-2 text-base font-semibold text-foreground">
            <NotebookPen className="size-4 text-muted-foreground" aria-hidden="true" />
            {edit ? "학습 기록 고치기" : "학습 기록 남기기"}
          </h2>
          <button
            type="button"
            onClick={closeQuickRecord}
            aria-label="닫기"
            className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="flex flex-col gap-4 px-5 py-4">
          {fixedPage ? (
            <p className="flex items-center gap-2 rounded-lg bg-muted/60 px-3 py-2 text-sm text-foreground">
              <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span className="truncate font-medium">{fixedPage.title || "제목 없음"}</span>
              {linkedSubject && <span className="shrink-0 text-xs text-muted-foreground">{linkedSubject.name}</span>}
            </p>
          ) : (
            <Field label="과목" htmlFor="qr-subject">
              <SubjectPicker
                id="qr-subject"
                value={subjectId}
                onChange={(next) => {
                  setSubjectId(next)
                  setPageId(NO_PAGE)
                }}
                noneLabel={subjectId === null ? "어떤 과목을 공부했나요?" : undefined}
                autoFocus={subjectId === null}
              />
            </Field>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label="날짜" htmlFor="qr-date">
              <input
                id="qr-date"
                type="date"
                value={date}
                max={todayISO()}
                onChange={(e) => setDate(e.target.value)}
                className={pickerFieldClass}
              />
            </Field>
            <Field label="공부한 시간 (분)" htmlFor="qr-minutes">
              <input
                id="qr-minutes"
                type="number"
                inputMode="numeric"
                min={1}
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                placeholder="예: 50"
                className={pickerFieldClass}
              />
            </Field>
          </div>

          <UnderstandingRating value={understanding} onChange={setUnderstanding} />

          <Field label="무엇을 했나요" htmlFor="qr-content">
            <textarea
              id="qr-content"
              value={studyContent}
              onChange={(e) => setStudyContent(e.target.value)}
              rows={3}
              placeholder="예: 3장 수업 듣고 연습문제 1~5번"
              className={`${pickerFieldClass} resize-y`}
            />
          </Field>

          {more ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="어려웠던 점" htmlFor="qr-difficulties">
                <textarea
                  id="qr-difficulties"
                  value={difficulties}
                  onChange={(e) => setDifficulties(e.target.value)}
                  rows={2}
                  className={`${pickerFieldClass} resize-none`}
                />
              </Field>
              <Field label="다음에 할 일" htmlFor="qr-next">
                <textarea
                  id="qr-next"
                  value={nextSteps}
                  onChange={(e) => setNextSteps(e.target.value)}
                  rows={2}
                  className={`${pickerFieldClass} resize-none`}
                />
              </Field>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setMore(true)}
              className="self-start text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              + 어려웠던 점 · 다음에 할 일도 적기
            </button>
          )}
        </div>

        {!fixedPage && (
          <div className="mx-5 mb-4 rounded-lg border border-border">
            <button
              type="button"
              onClick={() => setLinkOpen((v) => !v)}
              aria-expanded={linkOpen}
              className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm"
            >
              <span className="font-medium text-foreground">
                노트에 연결 <span className="font-normal text-muted-foreground">{needsPage ? "(필수)" : "(선택)"}</span>
              </span>
              <span className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
                <span className="truncate">{linked ? linked.title || "제목 없음" : "연결 안 함"}</span>
                <ChevronDown className={`size-4 shrink-0 transition-transform ${linkOpen ? "rotate-180" : ""}`} />
              </span>
            </button>
            {linkOpen && (
              <div className="flex flex-col gap-1.5 border-t border-border px-3 py-3">
                <select
                  id="qr-page"
                  aria-label="연결할 노트"
                  value={pageId}
                  onChange={(e) => setPageId(e.target.value)}
                  disabled={pages.length === 0}
                  className={pickerFieldClass}
                >
                  <option value={NO_PAGE}>{needsPage ? "노트 선택" : "연결 안 함"}</option>
                  {pages.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title || "제목 없음"}
                    </option>
                  ))}
                </select>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {pages.length === 0
                    ? subjectId
                      ? "이 과목에는 아직 노트가 없어요."
                      : "과목을 먼저 골라 주세요."
                    : "다시 볼 정리가 있는 노트에 연결하면 그 노트의 복습일이 잡혀요."}
                </p>
              </div>
            )}
          </div>
        )}

        {destination && (
          <p role="status" className="mx-5 mb-4 text-xs leading-relaxed text-muted-foreground">
            {destination}
          </p>
        )}

        <div className="flex items-center justify-between gap-2 border-t border-border px-5 py-3.5">
          {edit ? (
            <button
              type="button"
              onClick={() => {
                deleteSubjectRecord(edit.id)
                closeQuickRecord()
                toast.success("기록을 삭제했어요")
              }}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
            >
              <Trash2 className="size-4" />
              삭제
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={closeQuickRecord}
              className="rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {edit ? "저장" : "기록하기"}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium text-card-foreground">
        {label}
      </label>
      {children}
    </div>
  )
}
