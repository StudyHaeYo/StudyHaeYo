import { describe, expect, it } from "vitest"
import { isPlanTodo, planToday } from "@/lib/study-stats"

describe("계획에서 만든 할 일 알아보기", () => {
  it("계획 이름 그대로, 또는 이름 + 길이", () => {
    expect(isPlanTodo("자료구조 집중", "자료구조 집중")).toBe(true)
    expect(isPlanTodo("자료구조 집중 40분", "자료구조 집중")).toBe(true)
    expect(isPlanTodo("자료구조 집중 1시간", "자료구조 집중")).toBe(true)
    expect(isPlanTodo("자료구조 집중 1시간 30분", "자료구조 집중")).toBe(true)
  })

  it("이름이 겹치는 다른 계획이나 할 일은 아니다", () => {
    expect(isPlanTodo("자료구조 집중 40분", "자료구조")).toBe(false)
    expect(isPlanTodo("자료구조 집중 복습", "자료구조 집중")).toBe(false)
    expect(isPlanTodo("자료구조", "")).toBe(false)
  })

  it("planToday가 지은 이름은 늘 알아본다", () => {
    const plan = { id: "p", title: "이번 주 전공 공부", target: { scope: "all" as const }, startDate: "2026-11-16", endDate: "2026-11-22", goal: "", goalMinutes: 600 }
    for (const studied of [0, 50, 125, 590]) {
      const ask = planToday({ plan, studiedMinutes: studied, daysLeft: 3 })
      expect(ask && isPlanTodo(ask.title, plan.title)).toBe(true)
    }
  })
})
