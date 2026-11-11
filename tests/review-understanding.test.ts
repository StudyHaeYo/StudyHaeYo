import { describe, expect, it } from "vitest"
import { reviewUnderstanding, type JudgedItem, type Judgment, type ReviewLevel } from "@/lib/review"

const row = (level: ReviewLevel, judgment: Judgment, written = false): JudgedItem => ({
  item: { blockId: `${level}-${Math.random()}`, type: "concept", level, label: "", hides: [] },
  judgment,
  written,
})

describe("복습 판정 → 이해도 (사다리, D-32)", () => {
  it("전부 몰랐으면 1", () => {
    expect(reviewUnderstanding([row("하", "wrong"), row("하", "wrong")])).toBe(1)
  })

  it("하나라도 떠올렸으면 2", () => {
    expect(reviewUnderstanding([row("하", "unsure"), row("하", "wrong")])).toBe(2)
  })

  it("노트 안 복습(한 단계, 답을 쓰지 않음)은 다 알아도 3까지", () => {
    expect(reviewUnderstanding([row("하", "right"), row("하", "right"), row("하", "right")])).toBe(3)
  })

  it("3개 이상이면 하나는 틀려도 통과", () => {
    expect(reviewUnderstanding([row("하", "right"), row("하", "right"), row("하", "wrong")])).toBe(3)
    expect(reviewUnderstanding([row("하", "right"), row("하", "wrong")])).toBe(2)
  })

  it("중을 답을 써서 맞히면 4, 상까지 써서 맞히면 5", () => {
    const low = [row("하", "right"), row("하", "right")]
    expect(reviewUnderstanding([...low, row("중", "right", true)])).toBe(4)
    expect(reviewUnderstanding([...low, row("중", "right", true), row("상", "right", true)])).toBe(5)
  })

  it("답을 쓰지 않고 맞힌 중 · 상은 올려 주지 않는다", () => {
    const low = [row("하", "right"), row("하", "right")]
    expect(reviewUnderstanding([...low, row("중", "right", false), row("상", "right", false)])).toBe(3)
  })
})
