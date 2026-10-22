"use client"

import { useTodayISO } from "@/hooks/use-today"
import { reviewCandidates } from "@/lib/study-candidates"
import { activePlans } from "@/lib/study-stats"
import { usePlans } from "@/lib/plans"
import { todayChecklist, useTodos, useTodosStatus } from "@/lib/todos"
import { useWorkspace } from "@/lib/workspace"

// One line under the home title: what today holds, counted from the same sources as the 오늘 할 일 card.
export function TodaySummary() {
  const workspace = useWorkspace()
  const plans = usePlans()
  const todos = useTodos()
  const todosStatus = useTodosStatus()
  const today = useTodayISO()
  if (!today) return <p className="mt-1 h-5" aria-hidden="true" />

  const reviewsToday = reviewCandidates(workspace, today).filter((c) => c.dueTone === "overdue" || c.dueTone === "today").length
  const plansEnding = activePlans(workspace, plans, today).filter((p) => p.daysLeft === 0).length
  const todosLeft = todosStatus === "ready" ? todayChecklist(todos, today).filter((t) => t.doneAt === null).length : 0

  const parts = [
    reviewsToday > 0 && { label: "복습할 노트", count: reviewsToday },
    plansEnding > 0 && { label: "오늘 마감되는 계획", count: plansEnding },
    todosLeft > 0 && { label: "남은 할 일", count: todosLeft },
  ].filter((p): p is { label: string; count: number } => Boolean(p))

  return (
    <p className="mt-1 text-sm text-muted-foreground text-pretty">
      {parts.length === 0
        ? "오늘 정해진 복습과 할 일이 없어요. 새로운 내용을 공부해 보세요."
        : parts.map((p, i) => (
            <span key={p.label}>
              {i > 0 && ", "}
              {p.label} <span className="font-semibold text-foreground">{p.count}개</span>
            </span>
          ))}
      {parts.length > 0 && "가 있어요."}
    </p>
  )
}
