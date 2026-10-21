"use client"

import { subjectMastery } from "@/lib/study-stats"
import { useWorkspace } from "@/lib/workspace"

export function SubjectMastery({ title = "나의 학습 상태" }: { title?: string }) {
  const items = subjectMastery(useWorkspace())

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <h2 className="mb-4 text-[15px] font-semibold text-foreground">{title}</h2>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">아직 학습 기록이 없어요. 기록을 남기면 과목별 이해도가 보여요.</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {items.map((item) => (
            <li key={item.subject}>
              <div className="mb-1.5 flex items-center justify-between text-sm">
                <span className="text-card-foreground">
                  {item.subject}
                  <span className="ml-1.5 text-xs text-muted-foreground">{`기록 ${item.recordCount}개`}</span>
                </span>
                <span className={`font-semibold ${item.progress < 50 ? "text-amber-600" : "text-indigo-600"}`}>
                  {item.progress}%
                </span>
              </div>
              <div
                className="h-2 w-full overflow-hidden rounded-full bg-muted"
                role="progressbar"
                aria-valuenow={item.progress}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${item.subject} 평균 이해도`}
              >
                <div
                  className={`h-full rounded-full ${item.progress < 50 ? "bg-amber-500" : "bg-indigo-600"}`}
                  style={{ width: `${item.progress}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
