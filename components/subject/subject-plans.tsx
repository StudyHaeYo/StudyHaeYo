"use client"

import Link from "next/link"
import { useTodayISO } from "@/hooks/use-today"
import { usePlans } from "@/lib/plans"
import { groupPlans } from "@/lib/study-stats"
import { useWorkspace } from "@/lib/workspace"
import { PlanCard } from "@/components/plan/plan-card"

export function SubjectPlans({ subjectId }: { subjectId: string }) {
  const workspace = useWorkspace()
  const today = useTodayISO()
  const plans = usePlans().filter((p) => p.target.scope === "subject" && p.target.subjectId === subjectId)
  const groups = today ? groupPlans(workspace, plans, today) : null

  return (
    <section aria-labelledby="subject-plans-title" className="flex flex-col gap-4">
      <h2 id="subject-plans-title" className="text-base font-semibold text-foreground">
        이 과목의 학습 계획
      </h2>

      {plans.length > 0 ? (
        groups === null ? (
          <div className="h-32 animate-pulse rounded-xl bg-muted" aria-hidden="true" />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {[...groups.active, ...groups.upcoming, ...groups.ended].map((item) => (
              <PlanCard key={item.plan.id} item={item} showTarget={false} />
            ))}
          </ul>
        )
      ) : (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-card/50 px-6 py-8 text-center">
          <p className="text-sm text-muted-foreground">이 과목을 대상으로 한 학습 계획이 없어요.</p>
          <Link href="/plan" className="text-sm font-medium text-indigo-600 hover:underline">
            학습 계획 만들기
          </Link>
        </div>
      )}
    </section>
  )
}
