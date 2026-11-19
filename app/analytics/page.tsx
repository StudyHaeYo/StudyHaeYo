"use client"

import { PageHeader, PageShell } from "@/components/page-shell"
import { AnalyticsTrend } from "@/components/learning-os/analytics-trend"
import { WeakSpots } from "@/components/learning-os/analytics-widgets"
import { useDocumentTitle } from "@/hooks/use-document-title"

// 학습 분석 (재설계 D-43): how the weeks went, in two parts — how much (학습 시간 and the calendar) and where it is weak
// (과목 → 약한 노트, each ending in a plan or a review). No records list (D-28) and no all-time numbers: the three
// totals said what the chart says, and an average of 1~5 looked more exact than it is (GPT 검토 11/18).
export default function AnalyticsPage() {
  useDocumentTitle("학습 분석")
  return (
    <PageShell width="wide">
      <PageHeader title="학습 분석" />
      <div className="flex flex-col gap-6">
        <AnalyticsTrend />
        <WeakSpots />
      </div>
    </PageShell>
  )
}
