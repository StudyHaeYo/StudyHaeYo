import { describe, expect, it } from "vitest"
import { markdownToBlocks, parseScore, scoreToUnderstanding } from "@/lib/ai"

describe("AI 답 → 노트 블록", () => {
  it("제목 · 목록 · 핵심 개념을 블록으로 바꾼다", () => {
    const blocks = markdownToBlocks("# 해시\n문단\n- 항목\n1. 번호\n## 핵심 개념\n- 해시 함수: 키를 인덱스로")
    expect(blocks.map((b) => b.type)).toEqual(["h1", "p", "li", "ol", "h2", "concept"])
  })

})

describe("채점 점수 → 이해도", () => {
  it("점수 줄을 읽는다", () => {
    expect(parseScore("1. 맞음\n점수: 4/5")).toMatchObject({ correct: 4, total: 5 })
    expect(parseScore("채점이 아닌 답")).toBeNull()
  })

  it("난이도별 점수는 사다리로 읽는다", () => {
    const all = parseScore("점수: 하 2/2 · 중 2/2 · 상 1/1")!
    const lowOnly = parseScore("점수: 하 2/2 · 중 0/2 · 상 0/1")!
    expect(scoreToUnderstanding(all)).toBe(5)
    expect(scoreToUnderstanding(lowOnly)).toBe(3)
  })
})
