"use client"

import Link from "next/link"
import { CalendarRange } from "lucide-react"
import { usePlans } from "@/lib/plans"
import { formatDate } from "@/lib/study-pages"

export function SubjectPlans({ subjectId }: { subjectId: string }) {
  const plans = usePlans().filter((p) => p.target.scope === "subject" && p.target.subjectId === subjectId)

  return (
    <section aria-labelledby="subject-plans-title" className="flex flex-col gap-4">
      <h2 id="subject-plans-title" className="text-base font-semibold text-foreground">
        이 과목의 학습 계획
      </h2>

      {plans.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {plans.map((plan) => (
            <li key={plan.id} className="flex flex-col gap-1 rounded-xl border border-border bg-card px-4 py-3">
              <p className="font-medium text-foreground">{plan.title}</p>
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <CalendarRange className="size-3.5" aria-hidden="true" />
                {formatDate(plan.startDate)} – {formatDate(plan.endDate)}
              </p>
              <p className="text-sm leading-relaxed text-muted-foreground">{plan.goal}</p>
            </li>
          ))}
        </ul>
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
