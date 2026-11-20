import { describe, expect, it } from "vitest"
import { addDays, computePageStats, studyPages, type PageStudyRecord, type StudyPage } from "@/lib/study-pages"
import { partialUnderstanding, reviewItems, reviewRecordText, reviewUnderstanding, type JudgedItem, type Judgment } from "@/lib/review"
import { msToMinutes } from "@/lib/study-session"

// 노트 → 복습 → 기록 → 다음 복습일, the loop the app is built around, run through the same functions the screens call
// (note-review.tsx: reviewItems → reviewUnderstanding → a record; 홈 / 과목: computePageStats). One test per path a
// user takes, so a change in any one step shows up as a broken loop, not only as a changed number.
const lecture = studyPages.find((p) => p.id === "ds-3")!

const withRecords = (page: StudyPage, records: Pick<PageStudyRecord, "date" | "understanding">[]): StudyPage => ({
  ...page,
  studyRecords: records.map((r, i) => ({
    id: `flow-${i}`,
    pageId: page.id,
    durationMinutes: 30,
    studyContent: "",
    difficulties: "",
    nextSteps: "",
    tags: [],
    ...r,
  })),
})

const judge = (page: StudyPage, marks: (i: number) => Judgment): JudgedItem[] =>
  reviewItems(page, false).map((item, i) => ({ item, judgment: marks(i), written: false }))

describe("복습 흐름: 노트 → 복습 → 기록 → 다음 복습일", () => {
  const today = "2026-11-15"
  const before = withRecords(lecture, [{ date: "2026-11-01", understanding: 5 }])

  it("예시 강의 노트에는 복습할 곳이 3곳 이상 있다 (사다리의 '하나 틀려도 통과'가 걸리는 크기)", () => {
    expect(reviewItems(lecture, false).length).toBeGreaterThanOrEqual(3)
  })

  it("이해도 5인 노트가 14일 뒤 복습 목록에 오른다", () => {
    const stats = computePageStats(before, today)
    expect(stats.nextReviewAt).toBe(addDays("2026-11-01", 14))
    expect(stats.status).toBe("복습 필요")
  })

  it("다 알았으면 5가 유지되고, 다음 복습은 다시 14일 뒤", () => {
    const after = reviewUnderstanding(judge(before, () => "right"), computePageStats(before, today).understanding)
    expect(after).toBe(5)
    const next = computePageStats(withRecords(lecture, [{ date: "2026-11-01", understanding: 5 }, { date: today, understanding: after }]), today)
    expect(next.understanding).toBe(5)
    expect(next.nextReviewAt).toBe(addDays(today, 14))
    expect(next.status).toBe("완료")
  })

  it("하나 틀리면 사다리대로 3, 다음 복습은 4일 뒤로 당겨진다", () => {
    const after = reviewUnderstanding(judge(before, (i) => (i === 0 ? "wrong" : "right")), 5)
    expect(after).toBe(3)
    const next = computePageStats(withRecords(lecture, [{ date: "2026-11-01", understanding: 5 }, { date: today, understanding: after }]), today)
    expect(next.nextReviewAt).toBe(addDays(today, 4))
    expect(next.status).toBe("학습 중")
  })

  it("거의 다 몰랐으면 1, 다음 날 다시 나온다", () => {
    const after = reviewUnderstanding(judge(before, () => "wrong"), 5)
    expect(after).toBe(1)
    const next = computePageStats(withRecords(lecture, [{ date: "2026-11-01", understanding: 5 }, { date: today, understanding: after }]), today)
    expect(next.nextReviewAt).toBe(addDays(today, 1))
  })

  it("다 고르기 전에 나가면: 절반 넘게 골랐으면 고른 곳만으로 기록, 덜 골랐으면 기록 없음 (D-51)", () => {
    const all = judge(before, () => "right")
    const half = Math.ceil(all.length / 2)
    // fewer than half marked: nothing to judge by
    expect(partialUnderstanding(all.slice(0, half - 1), all.length)).toBeNull()
    // half marked, all known: the ladder (3), not the earlier 5 — the note comes back sooner, not 14 days later
    const marked = all.slice(0, half)
    const after = partialUnderstanding(marked, all.length)!
    expect(after).toBe(3)
    expect(reviewRecordText(marked, all.length).studyContent).toBe(`복습: ${all.length}곳 중 ${half}곳 확인 (알았음 ${half} · 헷갈림 0 · 몰랐음 0)`)
    const next = computePageStats(withRecords(lecture, [{ date: "2026-11-01", understanding: 5 }, { date: today, understanding: after }]), today)
    expect(next.nextReviewAt).toBe(addDays(today, 4))
  })
})

describe("학습 세션 → 기록 시간 (요약 창)", () => {
  // The summary heading and its rows use the same rounding (2026-11-14): a short session never reads "0분" above a
  // "1분" row.
  it.each([
    [20_000, 1],
    [89_000, 1],
    [90_000, 2],
    [50 * 60_000, 50],
  ])("%ims → %i분", (ms, minutes) => {
    expect(msToMinutes(ms)).toBe(minutes)
  })
})
