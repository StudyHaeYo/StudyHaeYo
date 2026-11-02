"use client"

import Link from "next/link"
import { BookOpen, FileText } from "lucide-react"
import type { AttachmentBlock, PageProps } from "@/lib/study-pages"

// The top of a note's body for kinds that need a value or two (D-30): set where it is used, not in a 속성 window.
// 시험 정리 has its own (ExamScope).

// 오답 노트: where the problems come from, like the header of an exam paper, and how many are still wrong.
export function WrongAnswersHead({
  source,
  onChange,
  problems,
  retryHref,
}: {
  source: string | undefined
  onChange: (patch: Partial<PageProps>) => void
  problems: { total: number; wrong: number }
  retryHref: string
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
        placeholder="어디서 나온 문제인가요? (예: 2024 정보처리기사 실기 2회…)"
        autoComplete="off"
        className="min-w-0 flex-1 bg-transparent text-base font-semibold text-foreground outline-none placeholder:font-medium placeholder:text-muted-foreground"
      />
      <p className="shrink-0 text-sm tabular-nums text-muted-foreground">
        {problems.total === 0 ? (
          "아래에 틀린 문제를 적어 보세요"
        ) : problems.wrong === 0 ? (
          `${problems.total}문제 모두 맞혔어요`
        ) : (
          <>
            {problems.total}문제 중 <b className="font-semibold text-amber-700">{problems.wrong}문제</b> 아직 틀림
            <Link href={retryHref} className="ml-2 font-semibold text-indigo-700 hover:underline">
              다시 풀기
            </Link>
          </>
        )}
      </p>
    </div>
  )
}

// 강의 노트: which PDF is the lecture material (opened beside the note), and the week.
export function LectureHead({
  props,
  onChange,
  pdfs,
  materialOpen,
  onToggleMaterial,
}: {
  props: PageProps
  onChange: (patch: Partial<PageProps>) => void
  pdfs: AttachmentBlock[]
  materialOpen: boolean
  onToggleMaterial: () => void
}) {
  const material = pdfs.find((p) => p.id === props.materialBlockId)
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border pb-4">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground">
        <FileText className="size-4" aria-hidden="true" />
      </span>
      {pdfs.length > 0 ? (
        <label className="flex min-w-0 items-center gap-2 text-sm">
          <span className="shrink-0 text-muted-foreground">강의 자료</span>
          <select
            value={props.materialBlockId ?? ""}
            onChange={(e) => onChange({ materialBlockId: e.target.value || undefined })}
            className="h-8 min-w-0 max-w-56 rounded-lg border border-border bg-background px-2 text-sm text-foreground outline-none focus:border-indigo-400"
          >
            <option value="">고르지 않음</option>
            {pdfs.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <p className="min-w-0 flex-1 text-sm text-muted-foreground">강의 PDF를 이 노트에 끌어다 놓으면, 여기서 골라 옆에 펴 두고 필기할 수 있어요.</p>
      )}
      <label className="flex items-center gap-2 text-sm">
        <span className="shrink-0 text-muted-foreground">주차</span>
        <input
          value={props.week ?? ""}
          onChange={(e) => onChange({ week: e.target.value })}
          placeholder="3주차…"
          autoComplete="off"
          className="h-8 w-20 rounded-lg border border-border bg-background px-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-indigo-400"
        />
      </label>
      {material && (
        <button
          type="button"
          onClick={onToggleMaterial}
          aria-pressed={materialOpen}
          className={`ml-auto inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-sm font-semibold transition-colors ${
            materialOpen ? "border-indigo-200 bg-indigo-50 text-indigo-700" : "border-border text-foreground hover:bg-accent"
          }`}
        >
          <BookOpen className="size-4" aria-hidden="true" />
          나란히 보기
        </button>
      )}
    </div>
  )
}
