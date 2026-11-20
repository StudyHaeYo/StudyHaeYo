import { describe, expect, it } from "vitest"
import { shiftMonth, studyMonth } from "@/lib/study-stats"
import { ddayLabel, upcomingDdays } from "@/lib/ddays"
import type { WorkspaceState } from "@/lib/workspace"

// 오늘 시간표 [월] (D-44): the month as 월~일 rows, study minutes per day; D-day counts.
const workspace = {
  groups: [],
  pages: [],
  subjectRecords: [
    { id: "a", date: "2026-11-01", durationMinutes: 30, understanding: 3, studyContent: "", difficulties: "", nextSteps: "", tags: [], subjectId: null },
    { id: "b", date: "2026-11-01", durationMinutes: 20, understanding: 3, studyContent: "", difficulties: "", nextSteps: "", tags: [], subjectId: null },
  ],
  order: [],
} as unknown as WorkspaceState

describe("학습 달력 한 달", () => {
  it("월요일부터 줄을 맞추고, 1일 앞과 말일 뒤는 빈칸", () => {
    // 2026-11-01 is a Sunday: six empty cells, then the 1st.
    const weeks = studyMonth(workspace, "2026-11", "2026-11-19")
    expect(weeks.every((w) => w.length === 7)).toBe(true)
    expect(weeks[0].slice(0, 6)).toEqual([null, null, null, null, null, null])
    expect(weeks[0][6]).toMatchObject({ date: "2026-11-01", minutes: 50, future: false })
    const days = weeks.flat().filter((d) => d !== null)
    expect(days).toHaveLength(30)
    expect(days.find((d) => d!.date === "2026-11-20")?.future).toBe(true)
  })

  it("달을 넘긴다", () => {
    expect(shiftMonth("2026-12", 1)).toBe("2027-01")
    expect(shiftMonth("2026-01", -1)).toBe("2025-12")
  })
})

describe("D-day", () => {
  it("남은 날, 당일, 지난 날", () => {
    expect(ddayLabel("2026-12-01", "2026-11-19")).toBe("D-12")
    expect(ddayLabel("2026-11-19", "2026-11-19")).toBe("D-day")
    expect(ddayLabel("2026-11-16", "2026-11-19")).toBe("D+3")
  })

  it("다가오는 것만 가까운 순으로", () => {
    const list = [
      { id: "1", title: "기말", date: "2026-12-10" },
      { id: "2", title: "지난 과제", date: "2026-11-10" },
      { id: "3", title: "실기", date: "2026-11-19" },
    ]
    expect(upcomingDdays(list, "2026-11-19").map((d) => d.title)).toEqual(["실기", "기말"])
  })
})
