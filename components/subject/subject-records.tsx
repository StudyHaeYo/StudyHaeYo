"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { FileText, Plus } from "lucide-react"
import { RecordCard } from "@/components/record-card"
import { computePageStats, formatDate, unresolvedConfusionCount } from "@/lib/study-pages"
import { descendantPages, useWorkspace } from "@/lib/workspace"
import { useTodayISO } from "@/hooks/use-today"

export function SubjectRecords({ subjectId, subjectName }: { subjectId: string; subjectName: string }) {
  const router = useRouter()
  const today = useTodayISO()
  const pages = descendantPages(useWorkspace(), subjectId)

  return (
    <section aria-labelledby="records-title" className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 id="records-title" className="text-base font-semibold text-foreground">
          페이지 목록
          <span className="ml-2 text-sm font-normal text-muted-foreground">{pages.length}</span>
        </h2>
        <Link
          href={`/new?parent=${subjectId}`}
          className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-700"
        >
          <Plus className="size-4" />새 페이지
        </Link>
      </div>

      {pages.length > 0 ? (
        <ul className="flex flex-col gap-3">
          {pages.map((page) => {
            const stats = computePageStats(page, today)
            return (
              <li key={page.id}>
                <RecordCard
                  record={{
                    id: page.id,
                    title: page.title || "제목 없음",
                    category: subjectName,
                    type: page.studyType ?? "정리",
                    createdAt: formatDate(page.createdAt),
                    understanding: stats.understanding ?? undefined,
                    reviewDate: stats.nextReviewAt ? formatDate(stats.nextReviewAt) : undefined,
                  }}
                  unresolvedConfusions={unresolvedConfusionCount(page)}
                  onClick={(id) => router.push(`/record/${id}`)}
                />
              </li>
            )
          })}
        </ul>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/50 px-6 py-12 text-center">
          <FileText className="mb-3 size-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">아직 작성된 페이지가 없습니다.</p>
        </div>
      )}
    </section>
  )
}
