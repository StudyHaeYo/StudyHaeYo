import { describe, expect, it } from "vitest"
import { addDays, computePageStats, nextReviewDate, type PageStudyRecord, type StudyPage } from "@/lib/study-pages"

const record = (date: string, understanding: number, extra: Partial<PageStudyRecord> = {}): PageStudyRecord => ({
  id: `r-${date}-${understanding}`,
  pageId: "p1",
  date,
  durationMinutes: 30,
  understanding,
  studyContent: "",
  difficulties: "",
  nextSteps: "",
  tags: [],
  ...extra,
})

const page = (records: PageStudyRecord[], extra: Partial<StudyPage> = {}): StudyPage =>
  ({ id: "p1", title: "해시테이블", parentId: null, templateId: "blank", blocks: [], tags: [], createdAt: "2026-11-01", studyRecords: records, ...extra }) as StudyPage

describe("다음 복습일 (이해도별 간격)", () => {
  it.each([
    [1, 1],
    [2, 2],
    [3, 4],
    [4, 7],
    [5, 14],
  ])("이해도 %i → %i일 뒤", (understanding, days) => {
    expect(nextReviewDate("2026-11-10", understanding)).toBe(addDays("2026-11-10", days))
  })

  it("달과 해를 넘긴다", () => {
    expect(nextReviewDate("2026-11-28", 3)).toBe("2026-12-02")
    expect(nextReviewDate("2026-12-25", 5)).toBe("2027-01-08")
  })
})

describe("노트 상태는 기록에서만 계산한다 (D-37)", () => {
  it("기록이 없으면 시작 전, 복습일 없음", () => {
    const stats = computePageStats(page([]), "2026-11-11")
    expect(stats).toMatchObject({ status: "시작 전", understanding: null, nextReviewAt: null, totalDurationMinutes: 0 })
  })

  it("가장 최근 기록의 이해도와 날짜로 복습일을 잡는다", () => {
    const stats = computePageStats(page([record("2026-11-01", 5), record("2026-11-09", 2)]), "2026-11-10")
    expect(stats.understanding).toBe(2)
    expect(stats.lastStudiedAt).toBe("2026-11-09")
    expect(stats.nextReviewAt).toBe("2026-11-11")
    expect(stats.status).toBe("학습 중")
    expect(stats.totalDurationMinutes).toBe(60)
  })

  it("복습일이 되면 복습 필요", () => {
    const p = page([record("2026-11-09", 2)])
    expect(computePageStats(p, "2026-11-11").status).toBe("복습 필요")
    expect(computePageStats(p, "2026-11-20").status).toBe("복습 필요")
  })

  it("같은 날 기록이 둘이면 나중에 남긴 것이 기준", () => {
    const early = record("2026-11-09", 5, { id: "a", createdAt: 1000 })
    const late = record("2026-11-09", 1, { id: "b", createdAt: 2000 })
    expect(computePageStats(page([late, early]), "2026-11-09").understanding).toBe(1)
    expect(computePageStats(page([early, late]), "2026-11-09").understanding).toBe(1)
  })

  it("이해도 5이고 복습일 전이면 완료", () => {
    expect(computePageStats(page([record("2026-11-10", 5)]), "2026-11-11").status).toBe("완료")
  })

  it("손으로 고른 예전 상태 · 이해도는 읽지 않는다", () => {
    const stats = computePageStats(page([record("2026-11-10", 2)], { status: "완료", understanding: 5 } as Partial<StudyPage>), "2026-11-10")
    expect(stats.understanding).toBe(2)
    expect(stats.status).toBe("학습 중")
  })

  it("시험 정리는 기록이 있어도 자기 복습일이 없다 (D-36)", () => {
    const exam = page([record("2026-11-09", 1)], { templateId: "study-note", props: { kind: "exam" } } as Partial<StudyPage>)
    expect(computePageStats(exam, "2026-11-20").nextReviewAt).toBeNull()
  })

  it("오늘 날짜를 모르면(서버 렌더) 복습 필요로 단정하지 않는다", () => {
    expect(computePageStats(page([record("2026-11-01", 1)]), null).status).toBe("학습 중")
  })
})
