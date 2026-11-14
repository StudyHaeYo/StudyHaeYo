"use client"

import Link from "next/link"
import { Plus } from "lucide-react"
import { formatDate } from "@/lib/study-pages"
import { subjectPageRows } from "@/lib/study-stats"
import { noteIcon } from "@/lib/templates"
import { useWorkspace } from "@/lib/workspace"
import { useTodayISO } from "@/hooks/use-today"
import { SectionHeader, emptyState, secondaryButton } from "@/components/page-shell"

export function SubjectRecords({ subjectId }: { subjectId: string }) {
  const today = useTodayISO()
  const rows = subjectPageRows(useWorkspace(), subjectId, today)
  const newPageHref = `/new?parent=${encodeURIComponent(subjectId)}`

  // A table from sm up; on a phone each note is its name, then one line of labelled values.
  const cols = "sm:grid sm:grid-cols-[minmax(0,1fr)_3.5rem_4.5rem_6.5rem] sm:items-center sm:gap-x-3"
  return (
    <section aria-labelledby="records-title" className="flex flex-col gap-1">
      <SectionHeader
        id="records-title"
        title="페이지 목록"
        count={rows.length}
        action={
          <Link href={newPageHref} className={secondaryButton}>
            <Plus />새 페이지
          </Link>
        }
      />

      {rows.length > 0 ? (
        <div className="border-y border-border">
          {/* Column names once, above the rows (they used to repeat inside every row). */}
          <div className={`${cols} hidden border-b border-border py-2 text-xs text-muted-foreground`} aria-hidden="true">
            <span>이름</span>
            <span>이해도</span>
            <span>마지막 학습</span>
            <span>다음 복습</span>
          </div>
          <ul className="divide-y divide-border">
            {rows.map(({ page, stats }) => {
              const Icon = noteIcon(page)
              const due = stats.status === "복습 필요"
              return (
                <li key={page.id}>
                  <Link href={`/record/${page.id}`} className={`${cols} -mx-2 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md px-2 py-3 text-[13px] transition-colors hover:bg-muted/60 sm:text-sm`}>
                    <span className="flex w-full min-w-0 items-center gap-2 text-sm sm:w-auto">
                      <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                      <span className="truncate font-medium text-foreground">{page.title || "제목 없음"}</span>
                    </span>
                    <span className="whitespace-nowrap tabular-nums text-muted-foreground">
                      <span className="sm:sr-only">이해도 </span>
                      {stats.understanding === null ? "—" : `${stats.understanding}/5`}
                    </span>
                    <span className="whitespace-nowrap tabular-nums text-muted-foreground">
                      <span className="sm:sr-only">마지막 학습 </span>
                      {stats.lastStudiedAt ? formatDate(stats.lastStudiedAt) : "—"}
                    </span>
                    {/* The one colour in the row: a note that is due (D-25, 줄마다 색 신호 하나). */}
                    <span className={`whitespace-nowrap ${due ? "font-medium text-attention-700" : "tabular-nums text-muted-foreground"}`}>
                      <span className={!due && stats.nextReviewAt ? "sm:sr-only" : "sr-only"}>다음 복습 </span>
                      {due ? "다시 볼 때예요" : stats.nextReviewAt ? formatDate(stats.nextReviewAt) : stats.status === "시작 전" ? "시작 전" : "—"}
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      ) : (
        <div className={`${emptyState} flex flex-col items-center gap-3`}>
          <p>이 과목에는 아직 페이지가 없어요.</p>
          <Link href={newPageHref} className={secondaryButton}>
            <Plus />이 과목에 새 페이지 만들기
          </Link>
        </div>
      )}
    </section>
  )
}
