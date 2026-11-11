import { describe, expect, it } from "vitest"
import { planToday } from "@/lib/study-stats"
import type { LearningPlan } from "@/lib/plans"

const plan = (goalMinutes?: number): LearningPlan => ({
  id: "p",
  title: "자료구조 집중",
  target: { scope: "all" },
  startDate: "2026-11-09",
  endDate: "2026-11-15",
  goal: "",
  ...(goalMinutes ? { goalMinutes } : {}),
})

describe("계획 → 오늘 시간표에 넣을 만큼", () => {
  it("남은 시간을 남은 날(오늘 포함)로 나눠 10분 단위로 올린다", () => {
    expect(planToday({ plan: plan(180), studiedMinutes: 65, daysLeft: 2 })).toEqual({ title: "자료구조 집중 40분", minutes: 40 })
  })

  it("마지막 날은 남은 만큼 전부", () => {
    expect(planToday({ plan: plan(180), studiedMinutes: 100, daysLeft: 0 })?.minutes).toBe(80)
  })

  it("목표를 채웠으면 없다", () => {
    expect(planToday({ plan: plan(180), studiedMinutes: 180, daysLeft: 3 })).toBeNull()
    expect(planToday({ plan: plan(180), studiedMinutes: 240, daysLeft: 3 })).toBeNull()
  })

  it("시간 목표가 없는 계획은 이름만", () => {
    expect(planToday({ plan: plan(), studiedMinutes: 30, daysLeft: 3 })).toEqual({ title: "자료구조 집중", minutes: null })
  })
})
