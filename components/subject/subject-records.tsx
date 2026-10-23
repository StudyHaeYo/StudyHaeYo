"use client"

import Link from "next/link"
import { FileText, Plus } from "lucide-react"
import { formatDate } from "@/lib/study-pages"
import { subjectPageRows } from "@/lib/study-stats"
import { resolveTreeAppearance } from "@/lib/templates"
import { useWorkspace } from "@/lib/workspace"
import { useTodayISO } from "@/hooks/use-today"

export function SubjectRecords({ subjectId }: { subjectId: string }) {
  const today = useTodayISO()
  const rows = subjectPageRows(useWorkspace(), subjectId, today)
  const newPageHref = `/new?parent=${encodeURIComponent(subjectId)}`

  return (
    <section aria-labelledby="records-title" className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 id="records-title" className="text-base font-semibold text-foreground">
          페이지 목록
          <span className="ml-2 text-sm font-normal text-muted-foreground">{rows.length}</span>
        </h2>
        <Link
          href={newPageHref}
          className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
        >
          <Plus className="size-4" />새 페이지
        </Link>
      </div>

      {rows.length > 0 ? (
        <ul className="flex flex-col divide-y divide-border border-y border-border">
          {rows.map(({ page, stats }) => {
            const Icon = resolveTreeAppearance(page).icon
            const due = stats.status === "복습 필요" ? "text-amber-700" : undefined
            return (
              <li key={page.id}>
                <Link
                  href={`/record/${page.id}`}
                  className="flex flex-col gap-2 px-4 py-3 transition-colors hover:bg-muted/50 sm:flex-row sm:items-center sm:gap-4"
                >
                  <span className="flex min-w-0 flex-1 items-center gap-2">
                    <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <span className="truncate font-medium text-foreground">{page.title || "제목 없음"}</span>
                  </span>
                  <dl className="grid grid-cols-4 gap-3 text-xs sm:w-96 sm:shrink-0">
                    <Cell label="상태" value={stats.status} tone={due} />
                    <Cell label="이해도" value={stats.understanding === null ? "—" : `${stats.understanding}/5`} />
                    <Cell label="마지막 학습" value={stats.lastStudiedAt ? formatDate(stats.lastStudiedAt) : "—"} />
                    <Cell label="다음 복습" value={stats.nextReviewAt ? formatDate(stats.nextReviewAt) : "—"} tone={due} />
                  </dl>
                </Link>
              </li>
            )
          })}
        </ul>
      ) : (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-card/50 px-6 py-12 text-center">
          <FileText className="size-6 text-muted-foreground" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">이 과목에는 아직 페이지가 없어요.</p>
          <Link
            href={newPageHref}
            className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3.5 py-2 text-sm font-medium text-indigo-700 transition-colors hover:bg-indigo-100"
          >
            <Plus className="size-4" />이 과목에 새 페이지 만들기
          </Link>
        </div>
      )}
    </section>
  )
}

function Cell({ label, value, tone = "text-foreground" }: { label: string; value: string; tone?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={`font-medium ${tone}`}>{value}</dd>
    </div>
  )
}
