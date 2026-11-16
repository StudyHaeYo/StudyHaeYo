import { describe, expect, it } from "vitest"
import { breakdownSlot, studyBreakdown } from "@/lib/study-stats"
import type { WorkspaceState } from "@/lib/workspace"
import type { StudyPage, StudyRecordFields } from "@/lib/study-pages"

// 학습 분석 "무엇을 얼마나" (2026-11-16): bars split by subject, subjects split by note.
const rec = (id: string, date: string, minutes: number): StudyRecordFields => ({
  id,
  date,
  durationMinutes: minutes,
  understanding: 3,
  studyContent: "",
  difficulties: "",
  nextSteps: "",
  tags: [],
})
const page = (id: string, title: string, parentId: string, records: StudyRecordFields[]): StudyPage => ({
  id,
  title,
  parentId,
  templateId: "blank",
  blocks: [],
  tags: [],
  createdAt: "2026-11-01",
  studyRecords: records.map((r) => ({ ...r, pageId: id })),
})
const subjects = ["ds", "os", "db", "net", "eng", "math"]
const workspace: WorkspaceState = {
  groups: subjects.map((id) => ({ id, name: id.toUpperCase(), parentId: null, kind: "subject" as const })),
  pages: [
    page("ds-1", "트리", "ds", [rec("a", "2026-11-16", 30), rec("b", "2026-11-17", 20)]),
    page("ds-2", "그래프", "ds", [rec("c", "2026-11-17", 50)]),
    page("os-1", "프로세스", "os", [rec("d", "2026-11-10", 40)]),
    page("db-1", "정규화", "db", [rec("e", "2026-11-17", 25)]),
    page("net-1", "TCP", "net", [rec("f", "2026-11-17", 15)]),
    page("eng-1", "단어", "eng", [rec("g", "2026-11-17", 10)]),
    page("math-1", "적분", "math", [rec("h", "2026-11-18", 5)]), // after today: not counted
  ],
  subjectRecords: [{ ...rec("i", "2026-11-17", 12), subjectId: "os" }],
  order: [],
}
const today = "2026-11-17" // Tuesday

describe("과목별로 나눈 학습 시간", () => {
  it("이번 주 일별: 월~일 7칸, 오늘 뒤는 future, 오늘 막대는 과목 → 노트로 나뉜다", () => {
    const { buckets } = studyBreakdown(workspace, today, "day")
    expect(buckets.map((b) => b.start)).toEqual(["2026-11-16", "2026-11-17", "2026-11-18", "2026-11-19", "2026-11-20", "2026-11-21", "2026-11-22"])
    expect(buckets[2].future).toBe(true)
    const tue = buckets[1]
    expect(tue.isCurrent).toBe(true)
    expect(tue.minutes).toBe(20 + 50 + 25 + 15 + 10 + 12)
    expect(tue.subjects[0]).toMatchObject({ key: "ds", minutes: 70 })
    expect(tue.subjects[0].notes.map((n) => [n.title, n.minutes])).toEqual([["그래프", 50], ["트리", 20]])
    expect(tue.subjects.find((s) => s.key === "os")!.notes[0]).toMatchObject({ title: "과목에 바로 남긴 기록", minutes: 12, href: "/subject/os" })
  })

  it("주별: 막대 합이 그 주 기록 합과 같다 (지난주 운영체제 40분)", () => {
    const { buckets } = studyBreakdown(workspace, today, "week", 2)
    expect(buckets.map((b) => [b.start, b.minutes])).toEqual([["2026-11-09", 40], ["2026-11-16", 30 + 20 + 50 + 25 + 15 + 10 + 12]])
  })

  it("과목이 다섯 개 이상이면 많이 한 넷만 색, 나머지는 기타", () => {
    const { legend } = studyBreakdown(workspace, today, "week", 2)
    expect(legend.map((l) => l.key)).toEqual(["ds", "os", "db", "net", "other"])
    expect(legend.at(-1)!.minutes).toBe(10)
    expect(breakdownSlot(legend, "eng")).toBe(4)
    expect(breakdownSlot(legend, "ds")).toBe(0)
  })
})
