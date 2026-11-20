import { describe, expect, it } from "vitest"
import {
  MAX_ATTEMPTS,
  problemAttempts,
  problemSolved,
  rightDays,
  sameProblemKey,
  withAttempt,
  wrongProblems,
  type TextBlock,
} from "@/lib/study-pages"

// D-39 (최종 발표 질문, 2026-11-16): same problem merged, tries kept, solved only when right on two different days.
const problem = (extra: Partial<TextBlock> = {}): TextBlock => ({ id: "p1", type: "toggle", text: "스택과 큐의 차이는?", body: "LIFO / FIFO", ...extra })
const tries = (...marks: ["right" | "wrong", string][]) => marks.reduce((b, [r, on]) => withAttempt(b, r, on), problem())

describe("같은 문제", () => {
  it("띄어쓰기 · 문장부호만 다르면 같은 문제", () => {
    expect(sameProblemKey("스택과 큐의 차이는?")).toBe(sameProblemKey("스택과큐의 차이는"))
    expect(sameProblemKey("[중] 스택과 큐의 차이는?")).toBe(sameProblemKey("[중]스택과 큐의 차이는."))
  })
  it("글자가 다르면 다른 문제 (뜻으로 합치지 않는다)", () => {
    expect(sameProblemKey("스택과 큐의 차이는?")).not.toBe(sameProblemKey("큐와 스택의 차이는?"))
    expect(sameProblemKey("1+1=2")).not.toBe(sameProblemKey("11=2")) // 기호는 문장부호가 아니다
  })
})

describe("푼 기록", () => {
  it("result · triedOn은 마지막 시도와 같다", () => {
    const b = tries(["wrong", "2026-11-16"], ["right", "2026-11-17"])
    expect(b.attempts).toEqual([
      { on: "2026-11-16", result: "wrong" },
      { on: "2026-11-17", result: "right" },
    ])
    expect(b).toMatchObject({ result: "right", triedOn: "2026-11-17" })
  })
  it("같은 날 다시 누르면 그날 것을 바꾼다", () => {
    const b = tries(["wrong", "2026-11-17"], ["right", "2026-11-17"])
    expect(b.attempts).toEqual([{ on: "2026-11-17", result: "right" }])
  })
  it(`최근 ${MAX_ATTEMPTS}개만 남긴다`, () => {
    const marks = Array.from({ length: 13 }, (_, i) => ["wrong", `2026-11-${String(i + 1).padStart(2, "0")}`] as ["wrong", string])
    const b = tries(...marks)
    expect(b.attempts).toHaveLength(MAX_ATTEMPTS)
    expect(b.attempts![0].on).toBe("2026-11-04")
  })
  it("attempts가 없는 예전 문제는 result · triedOn이 시도 하나", () => {
    expect(problemAttempts(problem({ result: "wrong", triedOn: "2026-11-10" }))).toEqual([{ on: "2026-11-10", result: "wrong" }])
  })
})

describe("다른 날 두 번 연속 맞혀야 끝난다", () => {
  it("한 번 맞힘은 아직 다시 풀기에 남는다", () => {
    const b = tries(["wrong", "2026-11-15"], ["right", "2026-11-16"])
    expect(rightDays(b)).toBe(1)
    expect(problemSolved(b)).toBe(false)
    expect(wrongProblems([b])).toHaveLength(1)
  })
  it("다른 날 두 번이면 끝", () => {
    const b = tries(["wrong", "2026-11-15"], ["right", "2026-11-16"], ["right", "2026-11-18"])
    expect(problemSolved(b)).toBe(true)
    expect(wrongProblems([b])).toHaveLength(0)
  })
  it("맞힘 · 틀림 · 맞힘은 끝나지 않는다 (교수님 질문의 경우)", () => {
    expect(problemSolved(tries(["right", "2026-11-15"], ["wrong", "2026-11-16"], ["right", "2026-11-17"]))).toBe(false)
  })
  it("이미 맞힘인 예전 문제는 그대로 끝난 것", () => {
    expect(problemSolved(problem({ result: "right", triedOn: "2026-11-01" }))).toBe(true)
    // 그 문제를 다시 틀리면 다시 나온다
    expect(problemSolved(withAttempt(problem({ result: "right", triedOn: "2026-11-01" }), "wrong", "2026-11-17"))).toBe(false)
  })
})
