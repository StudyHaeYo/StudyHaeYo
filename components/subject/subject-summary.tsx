"use client"

import { formatDate } from "@/lib/study-pages"
import { subjectSummary } from "@/lib/study-stats"
import { useWorkspace } from "@/lib/workspace"

function formatMinutes(minutes: number) {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}분`
  return m === 0 ? `${h}시간` : `${h}시간 ${m}분`
}

export function SubjectSummaryPanel({ subjectId }: { subjectId: string }) {
  const summary = subjectSummary(useWorkspace(), subjectId)

  const items = [
    { label: "페이지", value: `${summary.pageCount}개` },
    { label: "총 학습 시간", value: formatMinutes(summary.totalMinutes) },
    {
      label: "평균 이해도",
      value: summary.averageUnderstanding === null ? "—" : `${summary.averageUnderstanding} / 5`,
    },
    { label: "마지막 학습", value: summary.lastStudiedAt ? formatDate(summary.lastStudiedAt) : "—" },
  ]

  return (
    <section aria-label="과목 요약">
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 border-y border-border py-4 sm:grid-cols-4">
        {items.map((item) => (
          <div key={item.label} className="flex flex-col gap-0.5">
            <dt className="text-xs text-muted-foreground">{item.label}</dt>
            <dd className="text-base font-semibold tabular-nums text-foreground">{item.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
