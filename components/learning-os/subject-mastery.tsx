"use client"

import Link from "next/link"
import { subjectMastery } from "@/lib/study-stats"
import { useWorkspace } from "@/lib/workspace"

// Each subject leads somewhere: its name to the subject page, and a weak one (below half) to a new plan for it, so
// 학습 분석 ends in a next step instead of only showing numbers (2026-11-15).
export function SubjectMastery({ title = "나의 학습 상태" }: { title?: string }) {
  const workspace = useWorkspace()
  const items = subjectMastery(workspace)
  const subjectId = (name: string) => workspace.groups.find((g) => g.kind === "subject" && g.name === name)?.id

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <h2 className="mb-4 text-[15px] font-semibold text-foreground">{title}</h2>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">아직 학습 기록이 없어요. 기록을 남기면 과목별 이해도가 보여요.</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {items.map((item) => {
            const id = subjectId(item.subject)
            const weak = item.progress < 50
            return (
              <li key={item.subject}>
                <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
                  <span className="min-w-0 text-card-foreground">
                    {id ? (
                      <Link
                        href={`/subject/${id}`}
                        className="rounded hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action-500"
                      >
                        {item.subject}
                      </Link>
                    ) : (
                      item.subject
                    )}
                    <span className="ml-1.5 text-xs text-muted-foreground">{`기록 ${item.recordCount}개`}</span>
                    {id && weak && (
                      <Link
                        href={`/plan?subject=${id}`}
                        className="ml-2 whitespace-nowrap rounded text-xs font-medium text-action-700 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action-500"
                      >
                        계획 세우기
                      </Link>
                    )}
                  </span>
                  <span className={`shrink-0 font-semibold tabular-nums ${weak ? "text-attention-700" : "text-action-600"}`}>
                    {item.average.toFixed(1)}
                    <span className="font-normal text-muted-foreground"> / 5</span>
                  </span>
                </div>
                <div
                  className="h-2 w-full overflow-hidden rounded-full bg-muted"
                  role="progressbar"
                  aria-valuenow={item.average}
                  aria-valuemin={1}
                  aria-valuemax={5}
                  aria-label={`${item.subject} 평균 이해도`}
                >
                  <div
                    className={`h-full rounded-full ${weak ? "bg-attention-500" : "bg-action-600"}`}
                    style={{ width: `${item.progress}%` }}
                  />
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
