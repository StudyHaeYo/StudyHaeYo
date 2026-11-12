"use client"

import Link from "next/link"
import { BookOpen, FileText, Upload } from "lucide-react"
import type { AttachmentBlock, PageProps } from "@/lib/study-pages"

// The top of a note's body for kinds that need a value or two (D-30): set where it is used, not in a 속성 window.
// 시험 정리 has its own (ExamScope).

// 오답 노트: where the problems come from, like the header of an exam paper, and how many are still wrong.
export function WrongAnswersHead({
  source,
  onChange,
  problems,
  reasons,
  retryHref,
}: {
  source: string | undefined
  onChange: (patch: Partial<PageProps>) => void
  problems: { total: number; wrong: number }
  // Why the problems went wrong, counted (reasonSummary, D-35): "개념 1 · 실수 2". Empty when none was picked.
  reasons?: string
  // Unset while the note is being reviewed: the retry is already happening in place.
  retryHref?: string
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1 border-b-[3px] border-double border-border pb-2.5">
      <label htmlFor="wrong-source" className="sr-only">
        문제 출처
      </label>
      <input
        id="wrong-source"
        value={source ?? ""}
        onChange={(e) => onChange({ source: e.target.value })}
        placeholder="어디서 나온 문제인가요?"
        autoComplete="off"
        className="min-w-0 flex-1 bg-transparent text-base font-semibold text-foreground outline-none placeholder:font-medium placeholder:text-muted-foreground"
      />
      {/* Wraps on a phone: with the reasons it no longer fits one line there. */}
      <p className="min-w-0 text-sm tabular-nums text-muted-foreground">
        {problems.total === 0 ? (
          "아래에 틀린 문제를 적어 보세요"
        ) : problems.wrong === 0 ? (
          `${problems.total}문제 모두 맞혔어요`
        ) : (
          <>
            {problems.total}문제 중 <b className="font-semibold text-attention-700">{problems.wrong}문제</b> 아직 틀림
            {reasons && <span className="ml-1">· {reasons}</span>}
            {retryHref && (
              <Link href={retryHref} className="ml-2 font-semibold text-action-700 hover:underline">
                다시 풀기
              </Link>
            )}
          </>
        )}
      </p>
    </div>
  )
}

// 강의 노트: the week and which PDF is the lecture material (opened beside the note). One quiet line of text, not
// form boxes (2026-11-13): the controls look like words until pointed at, so the note still reads as a page.
export function LectureHead({
  props,
  onChange,
  pdfs,
  onUpload,
  materialOpen,
  onToggleMaterial,
}: {
  props: PageProps
  onChange: (patch: Partial<PageProps>) => void
  pdfs: AttachmentBlock[]
  onUpload: (files: File[]) => void
  materialOpen: boolean
  onToggleMaterial: () => void
}) {
  const material = pdfs.find((p) => p.id === props.materialBlockId)
  const quiet =
    "rounded px-1 py-0.5 text-sm outline-none transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-action-500"
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-b border-border pb-3 text-sm">
      <label className="flex items-center gap-1">
        <span className="shrink-0 text-muted-foreground">주차</span>
        <input
          value={props.week ?? ""}
          onChange={(e) => onChange({ week: e.target.value })}
          placeholder="비어 있음"
          autoComplete="off"
          size={Math.max(4, (props.week ?? "").length + 1)}
          className={`${quiet} text-foreground placeholder:text-muted-foreground/60`}
        />
      </label>
      <span className="flex min-w-0 items-center gap-1">
        <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className="shrink-0 text-muted-foreground">강의 자료</span>
        {pdfs.length > 0 ? (
          <select
            aria-label="강의 자료"
            value={props.materialBlockId ?? ""}
            onChange={(e) => onChange({ materialBlockId: e.target.value || undefined })}
            className={`${quiet} min-w-0 max-w-56 cursor-pointer bg-transparent text-foreground`}
          >
            <option value="">고르지 않음</option>
            {pdfs.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        ) : (
          // A button, not only drag and drop: phones have no dragging. The PDF opens beside the note once uploaded.
          <label className={`${quiet} inline-flex cursor-pointer items-center gap-1 font-medium text-action-700 has-[:focus-visible]:bg-accent has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-action-500`}>
            <Upload className="size-3.5" aria-hidden="true" />
            PDF 올리기
            <input
              type="file"
              accept="application/pdf"
              className="sr-only"
              onChange={(e) => {
                const files = Array.from(e.target.files ?? [])
                e.target.value = ""
                if (files.length > 0) onUpload(files)
              }}
            />
          </label>
        )}
      </span>
      {material && (
        <button
          type="button"
          onClick={onToggleMaterial}
          aria-pressed={materialOpen}
          className={`ml-auto inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-sm font-medium transition-colors ${
            materialOpen ? "bg-action-50 text-action-700" : "text-foreground hover:bg-accent"
          }`}
        >
          <BookOpen className="size-4" aria-hidden="true" />
          나란히 보기
        </button>
      )}
    </div>
  )
}
