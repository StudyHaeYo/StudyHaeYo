"use client"

import { formatDate } from "@/lib/study-pages"
import { subjectSummary } from "@/lib/study-stats"
import { useWorkspace } from "@/lib/workspace"
import { StatStrip } from "@/components/page-shell"

function formatMinutes(minutes: number) {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}분`
  return m === 0 ? `${h}시간` : `${h}시간 ${m}분`
}

export function SubjectSummaryPanel({ subjectId }: { subjectId: string }) {
  const summary = subjectSummary(useWorkspace(), subjectId)

  const items = [
    { label: "노트", value: `${summary.pageCount}개` },
    { label: "총 학습 시간", value: formatMinutes(summary.totalMinutes) },
    {
      label: "평균 이해도",
      value: summary.averageUnderstanding === null ? "—" : `${summary.averageUnderstanding} / 5`,
    },
    { label: "마지막 학습", value: summary.lastStudiedAt ? formatDate(summary.lastStudiedAt) : "—" },
  ]

  return <StatStrip label="과목 요약" items={items} />
}
