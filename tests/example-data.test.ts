import { describe, expect, it } from "vitest"
import { computePageStats, pageKind, problemBlocks, studyPages, wrongProblems } from "@/lib/study-pages"
import { reviewItems } from "@/lib/review"
import { studyTree } from "@/lib/study-tree"

// 예시 데이터 (발표용 데모 계정이 이걸 가져온다): every 노트 종류 is there and each one does what its kind promises.
describe("예시 데이터", () => {
  const byId = new Map(studyPages.map((p) => [p.id, p]))
  const groupIds = new Set(studyTree.flatMap((g) => [g.id, ...g.subjects.map((s) => s.id)]))

  it("노트 id가 겹치지 않고, 모두 있는 폴더 · 과목 안(또는 맨 위)에 있다", () => {
    expect(byId.size).toBe(studyPages.length)
    for (const p of studyPages) expect(p.parentId === null || groupIds.has(p.parentId)).toBe(true)
  })

  it("블록 id가 전체에서 겹치지 않는다", () => {
    const ids = studyPages.flatMap((p) => p.blocks.map((b) => b.id))
    expect(new Set(ids).size).toBe(ids.length)
  })

  it("강의 · 오답 · 시험 정리가 하나씩은 있다", () => {
    const kinds = studyPages.map((p) => pageKind(p))
    for (const kind of ["lecture", "wrong-answers", "exam"]) expect(kinds).toContain(kind)
  })

  it("강의 노트는 질문 단 줄만 복습에서 가린다", () => {
    const lecture = studyPages.find((p) => pageKind(p) === "lecture")!
    const items = reviewItems(lecture, false)
    expect(items.length).toBeGreaterThanOrEqual(3)
    expect(items.every((i) => i.type === "cue")).toBe(true)
  })

  it("오답 노트는 아직 틀린 문제가 있고, 기록이 없어도 만든 다음 날 다시 풀기에 나온다", () => {
    const wrong = studyPages.find((p) => pageKind(p) === "wrong-answers")!
    expect(problemBlocks(wrong.blocks).length).toBeGreaterThan(wrongProblems(wrong.blocks).length)
    expect(wrongProblems(wrong.blocks).length).toBeGreaterThan(0)
    expect(computePageStats(wrong, "2026-12-31").status).toBe("복습 필요")
  })

  it("시험 정리의 범위는 있는 노트만 가리키고, 시험일이 있다", () => {
    const exam = studyPages.find((p) => pageKind(p) === "exam")!
    expect(exam.props?.examDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(exam.props?.scope?.length).toBeGreaterThan(0)
    for (const id of exam.props?.scope ?? []) expect(byId.has(id)).toBe(true)
  })
})
