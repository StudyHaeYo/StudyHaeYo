"use client"

import { Plus } from "lucide-react"
import { PageHeader, StatStrip, primaryButton } from "@/components/page-shell"
import { AnalyticsTrend } from "@/components/learning-os/analytics-trend"
import { SubjectMastery } from "@/components/learning-os/subject-mastery"
import { WeakAreas } from "@/components/learning-os/analytics-widgets"
import { RecordsJournal } from "@/components/records/records-journal"
import { openQuickRecord } from "@/components/record/quick-record-dialog"
import { formatDuration } from "@/lib/study-pages"
import { allRecords } from "@/lib/study-stats"
import { unrecordedSessionMinutes, useStudySession } from "@/lib/study-session"
import { useWorkspace } from "@/lib/workspace"

// 돌아보기 (개편안 D-43): 학습 분석 and 학습 기록 on one screen — how the weeks went on top, then every record by day
// on the left with how each subject stands on the right. Looking back was two menus that sent you to each other.
export function LookBack() {
  const workspace = useWorkspace()
  const { pages } = workspace
  const pageRecords = pages.flatMap((p) => p.studyRecords)
  const records = allRecords(workspace)
  const session = useStudySession()
  const sessionMinutes = unrecordedSessionMinutes(session, pageRecords, Date.now(), new Set(pages.map((p) => p.id)))
  const totalMinutes = records.reduce((sum, r) => sum + r.durationMinutes, 0) + sessionMinutes
  const averageUnderstanding = records.length > 0 ? (records.reduce((sum, r) => sum + r.understanding, 0) / records.length).toFixed(1) : "-"

  return (
    <>
      <PageHeader
        title="돌아보기"
        actions={
          <button type="button" onClick={() => openQuickRecord()} className={primaryButton}>
            <Plus aria-hidden="true" />
            기록 남기기
          </button>
        }
      />
      <div className="flex flex-col gap-8">
        <StatStrip
          label="전체 요약"
          items={[
            {
              label: "총 학습 시간",
              value: formatDuration(totalMinutes),
              hint: sessionMinutes > 0 ? `기록 + 기록 전 타이머 ${formatDuration(sessionMinutes)}` : "학습 기록의 시간 합계",
            },
            { label: "학습 기록", value: `${records.length}개`, hint: "노트 · 과목 기록 전체" },
            { label: "평균 이해도", value: `${averageUnderstanding} / 5`, hint: "전체 기록 기준" },
          ]}
        />

        <AnalyticsTrend />

        <div className="grid items-start gap-x-10 gap-y-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <RecordsJournal embedded />
          <div className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-6">
            <SubjectMastery title="과목별 학습 상태" />
            <WeakAreas />
          </div>
        </div>
      </div>
    </>
  )
}
