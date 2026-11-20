"use client"

import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { useTodayISO } from "@/hooks/use-today"
import { RecordRow } from "@/components/record/record-row"
import { todayRecords } from "@/lib/study-stats"
import { recordCreatedAt } from "@/lib/study-session"
import { useWorkspace } from "@/lib/workspace"
import { RuledHeader } from "@/components/page-shell"

// 오늘의 기록 on Home: today's part of 학습 기록, in the same rows (D-28).
export function TodayRecords() {
  const workspace = useWorkspace()
  const today = useTodayISO()
  const entries = today ? todayRecords(workspace, today) : null

  return (
    <section aria-labelledby="today-records-heading">
      <RuledHeader
        id="today-records-heading"
        title="오늘의 기록"
        aside={
          <Link href="/records" className="inline-flex items-center gap-0.5 rounded font-medium transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action-500">
            전체 보기
            <ChevronRight className="size-3.5" aria-hidden="true" />
          </Link>
        }
      />
      {entries === null ? (
        <div className="flex flex-col gap-3" aria-hidden="true">
          <div className="h-16 animate-pulse rounded-xl bg-muted" />
          <div className="h-16 animate-pulse rounded-xl bg-muted" />
        </div>
      ) : entries.length === 0 ? (
        <div className="py-3">
          <p className="text-sm text-muted-foreground">오늘 아직 학습 기록이 없어요.</p>
          <p className="mt-0.5 text-pretty text-xs text-muted-foreground">
            공부를 마치고 [기록 남기기]로 남기면 여기에 보여요. 수업 · 문제집처럼 앱 밖에서 한 공부도 남길 수 있어요.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {entries.map((entry) => {
            const at = recordCreatedAt(entry.record)
            return (
              <li key={entry.record.id}>
                <RecordRow
                  entry={entry}
                  when={at === null ? undefined : new Intl.DateTimeFormat("ko-KR", { hour: "numeric", minute: "2-digit" }).format(at)}
                />
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
