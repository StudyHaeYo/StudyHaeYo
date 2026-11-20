"use client"

import Link from "next/link"
import { useTodayISO } from "@/hooks/use-today"
import { usePlans } from "@/lib/plans"
import { groupPlans } from "@/lib/study-stats"
import { useWorkspace } from "@/lib/workspace"
import { SectionHeader, emptyState } from "@/components/page-shell"
import { PlanCard } from "@/components/plan/plan-card"

export function SubjectPlans({ subjectId }: { subjectId: string }) {
  const workspace = useWorkspace()
  const today = useTodayISO()
  const plans = usePlans().filter((p) => p.target.scope === "subject" && p.target.subjectId === subjectId)
  const groups = today ? groupPlans(workspace, plans, today) : null

  return (
    <section aria-labelledby="subject-plans-title" className="flex flex-col gap-1">
      <SectionHeader id="subject-plans-title" title="이 과목의 학습 계획" count={plans.length > 0 ? plans.length : null} />

      {plans.length > 0 ? (
        groups === null ? (
          <div className="h-32 animate-pulse rounded-xl bg-muted" aria-hidden="true" />
        ) : (
          <ul className="divide-y divide-border border-y border-border">
            {[...groups.active, ...groups.upcoming, ...groups.ended].map((item) => (
              <PlanCard key={item.plan.id} item={item} showTarget={false} />
            ))}
          </ul>
        )
      ) : (
        <div className={`${emptyState} flex flex-col items-center gap-2`}>
          <p>이 과목을 대상으로 한 학습 계획이 없어요.</p>
          <Link href="/plan" className="text-sm font-medium text-action-600 hover:underline">
            계획 만들기
          </Link>
        </div>
      )}
    </section>
  )
}
