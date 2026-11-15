"use client"

import { PageHeader, PageShell, StatStrip } from "@/components/page-shell"
import { SubjectMastery } from "@/components/learning-os/subject-mastery"
import { AnalyticsTrend } from "@/components/learning-os/analytics-trend"
import { WeakAreas } from "@/components/learning-os/analytics-widgets"
import { formatDuration } from "@/lib/study-pages"
import { useDocumentTitle } from "@/hooks/use-document-title"
import { useWorkspace } from "@/lib/workspace"
import { allRecords } from "@/lib/study-stats"
import { unrecordedSessionMinutes, useStudySession } from "@/lib/study-session"

export default function AnalyticsPage() {
  useDocumentTitle("학습 분석")
  const workspace = useWorkspace()
  const { pages } = workspace
  const pageRecords = pages.flatMap((p) => p.studyRecords)
  const records = allRecords(workspace)
  const session = useStudySession()
  const sessionMinutes = unrecordedSessionMinutes(session, pageRecords, Date.now(), new Set(pages.map((p) => p.id)))
  const totalMinutes = records.reduce((sum, r) => sum + r.durationMinutes, 0) + sessionMinutes
  const averageUnderstanding = records.length > 0 ? (records.reduce((sum, r) => sum + r.understanding, 0) / records.length).toFixed(1) : "-"

  const summaryCards: { label: string; value: string; hint: string }[] = [
    {
      label: "총 학습 시간",
      value: formatDuration(totalMinutes),
      hint: sessionMinutes > 0 ? `학습 기록 + 기록 전 타이머 세션 ${formatDuration(sessionMinutes)}` : "학습 기록의 학습 시간 합계",
    },
    {
      label: "학습 기록 수",
      value: `${records.length}개`,
      hint: "페이지 · 과목 기록 전체",
    },
    {
      label: "평균 이해도",
      value: `${averageUnderstanding} / 5`,
      hint: "전체 기록 기준",
    },
  ]

  return (
    <PageShell width="wide">
      <PageHeader title="학습 분석" />
      <div className="flex flex-col gap-6">
        <StatStrip label="전체 요약" items={summaryCards} />

        <AnalyticsTrend />

        {/* Looking back only (2026-11-15): 복습 예정 was Home's review list and 최근 학습 활동 was 학습 기록. What a weak
            subject needs next is a plan, so its row leads to one (SubjectMastery). */}
        <div className="grid items-start gap-4 lg:grid-cols-2">
          <SubjectMastery title="과목별 학습 상태" />

          <WeakAreas />
        </div>
      </div>
    </PageShell>
  )
}
