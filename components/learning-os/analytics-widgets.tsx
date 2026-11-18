"use client"

import Link from "next/link"
import { reviewHref } from "@/lib/review"
import { subjectMastery, weakAreas, type WeakArea } from "@/lib/study-stats"
import { useWorkspace } from "@/lib/workspace"

// 약한 곳 (개편안 D-43): 과목별 학습 상태 and 취약 학습 영역 were two cards answering one question at two sizes. Now each
// subject, weakest first, with its weak notes under it — and each ends in a next step: a weak subject (below half)
// to a new plan for it, a weak note to its review (D-31: analysis that only shows numbers is a dead end).
export function WeakSpots() {
  const workspace = useWorkspace()
  const subjects = subjectMastery(workspace).sort((a, b) => a.average - b.average)
  const notes = weakAreas(workspace, 50)
  const notesOf = (subject: string) => notes.filter((n) => n.subject === subject)
  // Weak notes in a subject with no records yet still get a place, after the measured ones.
  const unmeasured = [...new Set(notes.map((n) => n.subject))].filter((s) => !subjects.some((m) => m.subject === s))
  const subjectId = (name: string) => workspace.groups.find((g) => g.kind === "subject" && g.name === name)?.id

  return (
    <section aria-labelledby="weak-spots-title" className="rounded-xl border border-border bg-card p-5">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h2 id="weak-spots-title" className="text-lg font-semibold tracking-tight text-foreground">
          약한 곳
        </h2>
        {subjects.length > 0 && <span className="text-xs text-muted-foreground">이해도 낮은 과목부터</span>}
      </div>
      {subjects.length === 0 && notes.length === 0 ? (
        <p className="text-sm text-pretty text-muted-foreground">아직 학습 기록이 없어요. 기록을 남기면 과목별 이해도와 약한 노트가 보여요.</p>
      ) : (
        <ul className="flex flex-col gap-5">
          {subjects.map((item) => {
            const id = subjectId(item.subject)
            const weak = item.progress < 50
            return (
              <li key={item.subject}>
                <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate">
                    {id ? (
                      <Link href={`/subject/${id}`} className="font-medium text-card-foreground hover:underline">
                        {item.subject}
                      </Link>
                    ) : (
                      <span className="font-medium text-card-foreground">{item.subject}</span>
                    )}
                    <span className="ml-1.5 text-xs text-muted-foreground">{`기록 ${item.recordCount}개`}</span>
                  </span>
                  <span className={`shrink-0 font-semibold tabular-nums ${weak ? "text-attention-700" : "text-action-600"}`}>
                    {item.average.toFixed(1)}
                    <span className="font-normal text-muted-foreground"> / 5</span>
                  </span>
                </div>
                <div
                  className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
                  role="progressbar"
                  aria-valuenow={item.average}
                  aria-valuemin={1}
                  aria-valuemax={5}
                  aria-label={`${item.subject} 평균 이해도`}
                >
                  <div className={`h-full rounded-full ${weak ? "bg-attention-500" : "bg-action-600"}`} style={{ width: `${item.progress}%` }} />
                </div>
                {id && weak && (
                  <Link href={`/plan?subject=${id}`} className="mt-1.5 inline-block text-xs font-medium text-action-700 hover:underline">
                    이 과목 계획 만들기
                  </Link>
                )}
                <NoteList notes={notesOf(item.subject)} />
              </li>
            )
          })}
          {unmeasured.map((subject) => (
            <li key={subject}>
              <p className="text-sm">
                <span className="font-medium text-card-foreground">{subject}</span>
                <span className="ml-1.5 text-xs text-muted-foreground">기록 없음</span>
              </p>
              <NoteList notes={notesOf(subject)} />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function NoteList({ notes }: { notes: WeakArea[] }) {
  if (notes.length === 0) return null
  return (
    <ul className="mt-2 flex flex-col border-l border-border pl-3">
      {notes.map((note) => (
        <li key={note.pageId}>
          <Link
            href={reviewHref(note.pageId)}
            className="group -mx-1.5 flex items-center justify-between gap-2 rounded-md px-1.5 py-1.5 text-sm transition-colors hover:bg-accent"
          >
            <span className="min-w-0">
              <span className="block truncate text-card-foreground">{note.pageTitle}</span>
              <span className="block truncate text-xs text-muted-foreground">
                {note.unresolved > 0 && <span className="font-medium text-attention-700">{`헷갈린 점 ${note.unresolved}개 남음 · `}</span>}
                {note.understanding === null ? "이해도 -" : `이해도 ${note.understanding}/5`}
              </span>
            </span>
            <span className="shrink-0 text-xs font-medium text-muted-foreground group-hover:text-foreground">복습하기</span>
          </Link>
        </li>
      ))}
    </ul>
  )
}
