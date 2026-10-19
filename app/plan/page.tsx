"use client"

import { Plus, Sparkles, Target } from "lucide-react"
import { Sidebar } from "@/components/sidebar"
import { LearningPlans } from "@/components/plan/learning-plans"
import { categories } from "@/lib/dummy-data"
import { useToday } from "@/hooks/use-today"

const weekDays = ["월", "화", "수", "목", "금", "토", "일"]

type WeeklyGoal = {
  id: string
  title: string
  category: string
  done: boolean
  recommended?: boolean
}

const weeklyPlan: Record<number, WeeklyGoal[]> = {
  0: [
    { id: "m1", title: "자료구조 3장", category: "자료구조", done: true },
    { id: "m2", title: "영단어 50개", category: "어학", done: false },
  ],
  1: [
    { id: "t1", title: "정보처리기사 실기 기출", category: "정보처리기사", done: false, recommended: true },
  ],
  2: [
    { id: "w1", title: "해시 테이블 복습", category: "자료구조", done: false, recommended: true },
    { id: "w2", title: "자료구조 4장", category: "자료구조", done: false },
  ],
  3: [{ id: "th1", title: "영단어 50개", category: "어학", done: false }],
  4: [{ id: "f1", title: "정보처리기사 실기 정리", category: "정보처리기사", done: false }],
  5: [{ id: "s1", title: "주간 복습", category: "자료구조", done: false }],
  6: [],
}

const monthlyGoals = [
  { id: "mo1", title: "정보처리기사 합격", progress: 65 },
  { id: "mo2", title: "자료구조 완독", progress: 40 },
  { id: "mo3", title: "토익 800점", progress: 25 },
]

export default function PlanPage() {
  const today = useToday()?.getDay() // 0=Sun..6=Sat
  const todayIndex = today === undefined ? -1 : today === 0 ? 6 : today - 1 // map to Mon-first

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <Sidebar />

      <main className="flex-1 overflow-y-auto px-6 py-6 lg:px-10">
        <div className="mx-auto max-w-5xl">
          <header className="mb-6 flex items-center justify-between gap-4">
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-foreground">
                이번 주 학습 계획
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                요일별로 목표를 세우고 진행 상황을 관리해보세요.
              </p>
            </div>
          </header>

          <LearningPlans />

          {/* Weekly calendar */}
          <section className="mb-8">
            <p className="mb-3 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Sparkles className="size-3.5 text-indigo-600" />
              <span>
                <span className="font-medium text-indigo-700">추천</span> 항목은 이해도와 복습 주기를 바탕으로
                시스템이 제안한 학습이에요.
              </span>
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
              {weekDays.map((day, i) => {
                const isToday = i === todayIndex
                const goals = weeklyPlan[i] ?? []
                return (
                  <div
                    key={day}
                    className={`flex min-h-40 flex-col rounded-xl border p-2 ${
                      isToday
                        ? "border-indigo-300 bg-indigo-50/60"
                        : "border-border bg-card"
                    }`}
                  >
                    <div className="mb-2 flex items-center justify-between px-1">
                      <span
                        className={`text-xs font-semibold ${
                          isToday ? "text-indigo-700" : "text-muted-foreground"
                        }`}
                      >
                        {day}
                      </span>
                      {isToday && (
                        <span className="rounded-full bg-indigo-600 px-1.5 py-0.5 text-[10px] font-medium text-white">
                          오늘
                        </span>
                      )}
                    </div>
                    <div className="flex flex-col gap-1.5">
                      {goals.map((goal) => (
                        <article
                          key={goal.id}
                          className={`rounded-lg border bg-card p-2 shadow-sm ${
                            goal.recommended ? "border-indigo-300 border-dashed" : "border-border"
                          }`}
                        >
                          <label className="flex items-start gap-1.5">
                            <input
                              type="checkbox"
                              defaultChecked={goal.done}
                              className="mt-0.5 size-3.5 shrink-0 accent-indigo-600"
                            />
                            <span
                              className={`text-xs leading-snug ${
                                goal.done
                                  ? "text-muted-foreground line-through"
                                  : "text-card-foreground"
                              }`}
                            >
                              {goal.title}
                            </span>
                          </label>
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            <span className="inline-block rounded-full bg-indigo-100 px-1.5 py-0.5 text-[10px] font-medium text-indigo-700">
                              {goal.category}
                            </span>
                            {goal.recommended && (
                              <span className="inline-flex items-center gap-0.5 rounded-full bg-indigo-600 px-1.5 py-0.5 text-[10px] font-medium text-white">
                                <Sparkles className="size-2.5" />
                                추천
                              </span>
                            )}
                          </div>
                        </article>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </section>

          {/* Monthly goals */}
          <section>
            <div className="mb-3 flex items-center gap-2">
              <Target className="size-4 text-indigo-600" />
              <h2 className="text-sm font-medium text-foreground">이번 달 목표</h2>
            </div>
            <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <ul className="flex flex-col gap-5">
                {monthlyGoals.map((goal) => (
                  <li key={goal.id}>
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-sm font-medium text-card-foreground">
                        {goal.title}
                      </span>
                      <span className="text-sm font-semibold text-indigo-600">
                        {goal.progress}%
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-indigo-600 transition-all"
                        style={{ width: `${goal.progress}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}
