import { describe, expect, it } from "vitest"
import { planToday } from "@/lib/study-stats"
import { slotsOn, type LearningPlan } from "@/lib/plans"
import { toPlanSlots } from "@/lib/db/rows"

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

// 공부할 시각 (D-46): only well-formed slots are kept, and a slot shows on its weekdays while the plan runs.
describe("계획의 공부할 시각", () => {
  it("이상한 값은 버린다", () => {
    expect(
      toPlanSlots([
        { pageId: "p1", days: [0, 2, 2], startMin: 1140, durationMin: 60 },
        { pageId: "p2", days: [], startMin: 600, durationMin: 60 },
        { pageId: "p3", days: [1], startMin: 1500, durationMin: 60 },
        "nope",
      ]),
    ).toEqual([{ pageId: "p1", days: [0, 2], startMin: 1140, durationMin: 60 }])
    expect(toPlanSlots(null)).toEqual([])
  })

  it("계획 기간 안의 그 요일에만", () => {
    const plan = {
      id: "x",
      title: "중간고사 대비",
      target: { scope: "all" as const },
      startDate: "2026-11-16",
      endDate: "2026-11-22",
      goal: "",
      slots: [{ pageId: "p1", days: [0, 2], startMin: 1140, durationMin: 60 }],
    }
    expect(slotsOn(plan, "2026-11-16")).toHaveLength(1) // 월
    expect(slotsOn(plan, "2026-11-17")).toHaveLength(0) // 화
    expect(slotsOn(plan, "2026-11-18")).toHaveLength(1) // 수
    expect(slotsOn(plan, "2026-11-23")).toHaveLength(0) // 기간 뒤 월요일
  })
})
