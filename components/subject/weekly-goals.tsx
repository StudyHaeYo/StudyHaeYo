"use client"

import { useState } from "react"
import { Check } from "lucide-react"
import type { WeeklyGoal } from "@/lib/study-tree"

export function WeeklyGoals({ initialGoals }: { initialGoals: WeeklyGoal[] }) {
  const [goals, setGoals] = useState(initialGoals)
  const doneCount = goals.filter((g) => g.done).length
  const percent = goals.length ? Math.round((doneCount / goals.length) * 100) : 0

  const toggle = (id: string) =>
    setGoals((prev) => prev.map((g) => (g.id === id ? { ...g, done: !g.done } : g)))

  return (
    <section
      aria-labelledby="weekly-goals-title"
      className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5"
    >
      <div className="flex items-center justify-between">
        <h2 id="weekly-goals-title" className="text-base font-semibold text-card-foreground">
          이번 주 목표
        </h2>
        <span className="text-sm text-muted-foreground">
          {doneCount}/{goals.length} 완료
        </span>
      </div>

      <div className="flex items-center gap-3">
        <div
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="이번 주 목표 진행률"
          className="h-2 flex-1 overflow-hidden rounded-full bg-muted"
        >
          <div
            className="h-full rounded-full bg-indigo-600 transition-all"
            style={{ width: `${percent}%` }}
          />
        </div>
        <span className="w-10 text-right text-sm font-semibold text-indigo-600">{percent}%</span>
      </div>

      <ul className="flex flex-col gap-1">
        {goals.map((goal) => (
          <li key={goal.id}>
            <label className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-accent">
              <input
                type="checkbox"
                checked={goal.done}
                onChange={() => toggle(goal.id)}
                className="peer sr-only"
              />
              <span
                aria-hidden="true"
                className={`flex size-5 shrink-0 items-center justify-center rounded-md border transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-indigo-300 ${
                  goal.done ? "border-indigo-600 bg-indigo-600 text-white" : "border-border bg-card"
                }`}
              >
                {goal.done && <Check className="size-3.5" />}
              </span>
              <span
                className={`text-sm ${goal.done ? "text-muted-foreground line-through" : "text-foreground"}`}
              >
                {goal.label}
              </span>
            </label>
          </li>
        ))}
      </ul>
    </section>
  )
}
