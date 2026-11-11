import { describe, expect, it } from "vitest"
import { clockLabel, layoutLanes, planRange, rangeLabel } from "@/lib/timetable"

describe("시간표 계산", () => {
  it("분을 시각으로 적는다", () => {
    expect(clockLabel(810)).toBe("13:30")
    expect(clockLabel(540)).toBe("9:00")
    expect(rangeLabel(810, 900)).toBe("13:30~15:00")
  })

  it("길이가 없으면 한 시간, 자정을 넘기지 않는다", () => {
    expect(planRange(810, 90)).toEqual({ start: 810, end: 900 })
    expect(planRange(600, null)).toEqual({ start: 600, end: 660 })
    expect(planRange(23 * 60 + 30, 120)).toEqual({ start: 1410, end: 1440 })
  })

  it("겹치지 않으면 모두 한 칸을 다 쓴다 (맞닿는 것은 겹침이 아니다)", () => {
    expect(layoutLanes([{ start: 540, end: 600 }, { start: 600, end: 690 }, { start: 800, end: 860 }])).toEqual([
      { lane: 0, lanes: 1 },
      { lane: 0, lanes: 1 },
      { lane: 0, lanes: 1 },
    ])
  })

  it("겹치면 나란히 놓고, 겹치지 않는 다른 시간은 그대로 넓게", () => {
    const placed = layoutLanes([{ start: 810, end: 900 }, { start: 845, end: 895 }, { start: 1000, end: 1060 }])
    expect(placed[0]).toEqual({ lane: 0, lanes: 2 })
    expect(placed[1]).toEqual({ lane: 1, lanes: 2 })
    expect(placed[2]).toEqual({ lane: 0, lanes: 1 })
  })

  it("사슬처럼 겹치면 비는 칸을 다시 쓴다", () => {
    // A 9~11, B 10~12 (A와 겹침), C 11~13 (B와만 겹침): C는 A가 끝난 첫 칸으로
    const placed = layoutLanes([{ start: 540, end: 660 }, { start: 600, end: 720 }, { start: 660, end: 780 }])
    expect(placed.map((p) => p.lane)).toEqual([0, 1, 0])
    expect(placed.every((p) => p.lanes === 2)).toBe(true)
  })

  it("넣은 순서와 상관없이 같은 결과", () => {
    const placed = layoutLanes([{ start: 845, end: 895 }, { start: 810, end: 900 }])
    expect(placed[1]).toEqual({ lane: 0, lanes: 2 })
    expect(placed[0]).toEqual({ lane: 1, lanes: 2 })
  })
})
