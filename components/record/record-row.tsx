"use client"

import { useEffect, useId, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { BookMarked, FilePlus2, FileText, Link2, MoreHorizontal, Pencil, Search, Trash2 } from "lucide-react"
import { openQuickRecord } from "@/components/record/quick-record-dialog"
import { ConfirmDeleteModal } from "@/components/sidebar/confirm-delete-modal"
import {
  addConfusions,
  formatDate,
  formatDuration,
  nextReviewDate,
  type PageStudyRecord,
  type SubjectStudyRecord,
} from "@/lib/study-pages"
import { recordBadge, recordText, wantsReviewNote, type RecordEntry } from "@/lib/study-stats"
import {
  applyStarter,
  attachRecordToPage,
  createPage,
  deleteSubjectRecord,
  descendantPages,
  updatePage,
  useWorkspace,
} from "@/lib/workspace"

// One study record, the same everywhere (D-28): what was done · where (note / subject / 과목 없음) · time · 이해도,
// then 어려웠던 점 and 다음에 할 일. Actions sit in a small menu so the list stays a quiet log.
export function RecordRow({
  entry,
  showWhere = true,
  when,
  actions = true,
}: {
  entry: RecordEntry
  // Off on a note's own list (every row is that note).
  showWhere?: boolean
  // Small text after the place: a date or a time of day.
  when?: string
  actions?: boolean
}) {
  const { record } = entry
  const badge = recordBadge(record.studyContent)
  const [linking, setLinking] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const suggest = actions && wantsReviewNote(entry)
  const pageRecord: PageStudyRecord | null = entry.pageId ? { ...record, pageId: entry.pageId } : null
  const subjectRecord: SubjectStudyRecord | null = entry.pageId ? null : { ...record, subjectId: entry.subjectId }

  return (
    <div className="group/row relative grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 py-3.5 pr-9 sm:pr-10">
      <p className="min-w-0 whitespace-pre-line text-[15px] leading-relaxed text-foreground">{recordText(entry)}</p>
      <div className="row-span-2 flex flex-col items-end gap-1 pt-0.5 text-right">
        <span className="text-sm font-medium tabular-nums text-foreground">{formatDuration(record.durationMinutes)}</span>
        <UnderstandingBars value={record.understanding} />
      </div>
      <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1.5 text-xs text-muted-foreground">
        {showWhere && <WherePill entry={entry} />}
        {badge && (
          <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-700">{badge}</span>
        )}
        {suggest && subjectRecord && (
          <button
            type="button"
            onClick={() => setLinking(true)}
            className="inline-flex h-6 items-center gap-1 rounded-md border border-dashed border-border px-2 font-semibold text-indigo-700 transition-colors hover:border-indigo-300 hover:bg-indigo-50"
          >
            <FilePlus2 className="size-3.5" aria-hidden="true" />
            복습 노트 만들기
          </button>
        )}
        {when && <span className="tabular-nums">{when}</span>}
      </div>
      {(record.difficulties || record.nextSteps) && (
        <div className="col-span-2 flex flex-col gap-0.5 text-[13px] leading-relaxed">
          {record.difficulties && <p className="text-amber-700">어려웠던 점 · {record.difficulties}</p>}
          {record.nextSteps && <p className="text-muted-foreground">다음에 할 일 · {record.nextSteps}</p>}
        </div>
      )}

      {actions && (
        <div className="absolute right-0 top-3">
          <button
            type="button"
            aria-label="기록 메뉴"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
            className="flex size-8 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-foreground focus-visible:opacity-100 group-hover/row:opacity-100 aria-expanded:opacity-100 [@media(hover:none)]:opacity-100"
          >
            <MoreHorizontal className="size-4" />
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-20" aria-hidden="true" onClick={() => setMenuOpen(false)} />
              <div
                role="menu"
                onKeyDown={(e) => e.key === "Escape" && setMenuOpen(false)}
                className="absolute right-0 top-9 z-30 w-44 rounded-xl border border-border bg-popover p-1 shadow-lg"
              >
                <MenuItem
                  autoFocus
                  icon={Pencil}
                  label="고치기"
                  onClick={() => {
                    setMenuOpen(false)
                    openQuickRecord({ edit: pageRecord ?? subjectRecord! })
                  }}
                />
                {subjectRecord && (
                  <MenuItem
                    icon={Link2}
                    label="노트에 연결"
                    onClick={() => {
                      setMenuOpen(false)
                      setLinking(true)
                    }}
                  />
                )}
                <MenuItem
                  icon={Trash2}
                  label="삭제"
                  danger
                  onClick={() => {
                    setMenuOpen(false)
                    setDeleting(true)
                  }}
                />
              </div>
            </>
          )}
        </div>
      )}

      {linking && subjectRecord && <LinkToNote record={subjectRecord} onClose={() => setLinking(false)} />}

      <ConfirmDeleteModal
        open={deleting}
        title={`${formatDate(record.date)} 학습 기록`}
        targetLabel="기록"
        note="삭제하면 학습 시간과 복습 일정에서도 빠져요."
        onCancel={() => setDeleting(false)}
        onConfirm={() => {
          setDeleting(false)
          if (pageRecord)
            updatePage(pageRecord.pageId, (p) => ({ ...p, studyRecords: p.studyRecords.filter((r) => r.id !== record.id) }))
          else deleteSubjectRecord(record.id)
          toast.success("기록을 삭제했어요")
        }}
      />
    </div>
  )
}

function MenuItem({
  icon: Icon,
  label,
  onClick,
  danger = false,
  autoFocus = false,
}: {
  icon: typeof Pencil
  label: string
  onClick: () => void
  danger?: boolean
  autoFocus?: boolean
}) {
  return (
    <button
      type="button"
      role="menuitem"
      autoFocus={autoFocus}
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors hover:bg-accent ${
        danger ? "text-destructive" : "text-foreground"
      }`}
    >
      <Icon className="size-4 opacity-70" aria-hidden="true" />
      {label}
    </button>
  )
}

export function UnderstandingBars({ value, size = "sm" }: { value: number; size?: "sm" | "md" }) {
  const bar = size === "md" ? "h-1.5 w-3" : "h-[5px] w-2.5"
  return (
    <span className="inline-flex items-center gap-1.5 text-xs tabular-nums text-muted-foreground" aria-label={`이해도 ${value}/5`}>
      <span className="inline-flex gap-0.5" aria-hidden="true">
        {[1, 2, 3, 4, 5].map((n) => (
          <span key={n} className={`${bar} rounded-full ${n <= value ? "bg-indigo-600" : "bg-indigo-100"}`} />
        ))}
      </span>
      {value}/5
    </span>
  )
}

function WherePill({ entry }: { entry: RecordEntry }) {
  const pill = "inline-flex h-6 max-w-56 items-center gap-1 rounded-md px-2 text-xs"
  if (entry.pageId)
    return (
      <Link href={`/record/${entry.pageId}`} className={`${pill} bg-indigo-50 font-semibold text-indigo-700 hover:bg-indigo-100`}>
        <FileText className="size-3.5 shrink-0" aria-hidden="true" />
        <span className="truncate">{entry.pageTitle}</span>
      </Link>
    )
  if (entry.subjectId)
    return (
      <Link href={`/subject/${entry.subjectId}`} className={`${pill} bg-muted text-foreground hover:bg-accent`}>
        <BookMarked className="size-3.5 shrink-0" aria-hidden="true" />
        <span className="truncate">{entry.subject}</span>
      </Link>
    )
  return <span className={`${pill} border border-border text-muted-foreground`}>과목 없음</span>
}

// "노트에 연결" / "복습 노트 만들기": a record without a note goes onto a new or existing note. Linking gives it a
// review date (D-24), and a written difficulty becomes the note's 헷갈린 점.
function LinkToNote({ record, onClose }: { record: SubjectStudyRecord; onClose: () => void }) {
  const workspace = useWorkspace()
  const router = useRouter()
  const [query, setQuery] = useState("")
  const boxRef = useRef<HTMLDivElement>(null)
  const listId = useId()

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener("mousedown", onDown)
    return () => document.removeEventListener("mousedown", onDown)
  }, [onClose])

  const inSubject = record.subjectId ? descendantPages(workspace, record.subjectId) : []
  const pool = query.trim()
    ? workspace.pages.filter((p) => (p.title || "제목 없음").toLowerCase().includes(query.trim().toLowerCase()))
    : inSubject.length > 0
      ? inSubject
      : [...workspace.pages].sort((a, b) => lastStudied(b).localeCompare(lastStudied(a)))
  const notes = pool.slice(0, 6)
  const subjectName = workspace.groups.find((g) => g.id === record.subjectId)?.name
  const title = record.studyContent.split("\n")[0].trim().slice(0, 60) || `${subjectName ?? "새"} 복습 노트`
  const review = formatDate(nextReviewDate(record.date, record.understanding))

  const afterLink = (pageId: string, created: boolean) => {
    onClose()
    toast.success(created ? "노트를 만들고 기록을 연결했어요" : "노트에 연결했어요", {
      description: `다음 복습은 ${review}이에요.`,
      action: created ? undefined : { label: "보기", onClick: () => router.push(`/record/${pageId}`) },
    })
    if (created) router.push(`/record/${pageId}`)
  }

  const makeNote = (starterId: "wrong-answers" | "study-note") => {
    const id = createPage({ title, starterId: "blank", parentId: record.subjectId })
    applyStarter(id, starterId)
    if (record.difficulties.trim())
      updatePage(id, (p) => ({ ...p, blocks: addConfusions(p.blocks, [record.difficulties.trim()]) }))
    attachRecordToPage(record, id)
    afterLink(id, true)
  }

  const option =
    "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"

  return (
    <div
      ref={boxRef}
      role="dialog"
      aria-label="노트에 연결"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation()
          onClose()
        }
      }}
      className="absolute left-0 right-0 top-full z-30 -mt-2 rounded-2xl border border-border bg-popover p-1.5 shadow-xl sm:left-auto sm:w-[22rem]"
    >
      <label className="flex h-9 items-center gap-2 rounded-lg bg-muted/70 px-2.5 text-sm text-muted-foreground">
        <Search className="size-4 shrink-0" aria-hidden="true" />
        <span className="sr-only">노트 찾기</span>
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="노트 찾기…"
          autoComplete="off"
          aria-controls={listId}
          className="min-w-0 flex-1 bg-transparent text-foreground outline-none placeholder:text-muted-foreground"
        />
      </label>
      <div id={listId} className="mt-1 flex flex-col">
        {!query.trim() && (
          <>
            <button type="button" onClick={() => makeNote("wrong-answers")} className={`${option} font-semibold text-indigo-700`}>
              <FilePlus2 className="size-4" aria-hidden="true" />새 오답 노트로 만들기
              {subjectName && <span className="ml-auto text-xs font-normal text-muted-foreground">{subjectName}</span>}
            </button>
            <button type="button" onClick={() => makeNote("study-note")} className={`${option} text-indigo-700`}>
              <FilePlus2 className="size-4" aria-hidden="true" />새 학습 노트로 만들기
            </button>
          </>
        )}
        <p className="px-2.5 pb-1 pt-2 text-[11px] text-muted-foreground">
          {query.trim() ? "찾은 노트" : inSubject.length > 0 ? `${subjectName}의 노트` : "최근 노트"}
        </p>
        {notes.length === 0 ? (
          <p className="px-2.5 py-2 text-sm text-muted-foreground">맞는 노트가 없어요.</p>
        ) : (
          notes.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                attachRecordToPage(record, p.id)
                afterLink(p.id, false)
              }}
              className={`${option} text-foreground`}
            >
              <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span className="truncate">{p.title || "제목 없음"}</span>
            </button>
          ))
        )}
      </div>
      <p className="mt-1 border-t border-border px-2.5 pb-1 pt-2 text-xs leading-relaxed text-muted-foreground">
        연결하면 이 기록으로 다음 복습({review})이 잡혀요.
        {record.difficulties.trim() && " 새 노트를 만들면 어려웠던 점이 헷갈린 점으로 들어가요."}
      </p>
    </div>
  )
}

function lastStudied(page: { studyRecords: { date: string }[] }) {
  return page.studyRecords.reduce((max, r) => (r.date > max ? r.date : max), "")
}
