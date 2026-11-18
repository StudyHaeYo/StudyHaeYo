"use client"

import { PageHeader } from "@/components/page-shell"
import { AnalyticsTrend } from "@/components/learning-os/analytics-trend"
import { WeakSpots } from "@/components/learning-os/analytics-widgets"
import { RecordsJournal } from "@/components/records/records-journal"

// 돌아보기 (개편안 D-43): "how did my studying go", in three parts read from wide to close — how much (학습 시간 and
// the calendar), where it is weak (약한 곳, each ending in a plan or a review), and what exactly (날짜별 기록).
// Left out on purpose: the all-time totals (학습 분석's three numbers; the chart says the same, better) and a second
// [기록 남기기] (the sidebar and the phone's top bar have it on every screen).
export function LookBack() {
  return (
    <>
      <PageHeader title="돌아보기" />
      <div className="flex flex-col gap-8">
        <AnalyticsTrend />
        <div className="grid items-start gap-x-10 gap-y-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <RecordsJournal embedded />
          <div className="min-w-0 lg:sticky lg:top-6">
            <WeakSpots />
          </div>
        </div>
      </div>
    </>
  )
}
