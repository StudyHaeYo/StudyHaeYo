import { beforeEach, describe, expect, it, vi } from "vitest"

// 노트 탭 (D-45, 2026-11-20): every note opened adds a tab after the current one; an open note goes to its tab.
type Tabs = typeof import("@/lib/note-tabs")
let tabs: Tabs
beforeEach(async () => {
  vi.resetModules()
  tabs = await import("@/lib/note-tabs")
})

describe("노트 탭", () => {
  it("다른 노트를 열면 지금 탭 오른쪽에 새 탭이 생긴다", () => {
    tabs.visitNote("a")
    tabs.visitNote("b")
    expect(tabs.peekNoteTabs()).toEqual({ ids: ["a", "b"], active: 1 })
    tabs.visitNote("c")
    expect(tabs.peekNoteTabs()).toEqual({ ids: ["a", "b", "c"], active: 2 })
    // already open in another tab: go to that tab, no second tab for the same note
    tabs.visitNote("a")
    expect(tabs.peekNoteTabs()).toEqual({ ids: ["a", "b", "c"], active: 0 })
    // a new note opened from the first tab goes right after it
    tabs.visitNote("d")
    expect(tabs.peekNoteTabs()).toEqual({ ids: ["a", "d", "b", "c"], active: 1 })
  })

  it("보던 탭을 닫으면 오른쪽(없으면 왼쪽) 탭을 보여 준다", () => {
    tabs.visitNote("a")
    tabs.visitNote("b")
    tabs.visitNote("c")
    tabs.visitNote("b") // active: b (index 1)
    expect(tabs.closeTab(1)).toBe("c")
    expect(tabs.peekNoteTabs()).toEqual({ ids: ["a", "c"], active: 1 })
    expect(tabs.closeTab(1)).toBe("a")
    expect(tabs.closeTab(0)).toBeNull()
  })

  it("닫은 노트를 다시 열면 보던 탭 오른쪽에 다시 생긴다", () => {
    tabs.visitNote("a")
    tabs.visitNote("b")
    tabs.visitNote("c")
    tabs.closeTab(1) // b
    tabs.visitNote("a")
    tabs.visitNote("b")
    expect(tabs.peekNoteTabs()).toEqual({ ids: ["a", "b", "c"], active: 1 })
  })

  it("열 개가 넘으면 보고 있지 않은 왼쪽 탭부터 닫힌다", () => {
    tabs.visitNote("t0")
    for (let i = 1; i <= 10; i++) tabs.visitNote(`t${i}`)
    const s = tabs.peekNoteTabs()
    expect(s.ids).toHaveLength(10)
    expect(s.ids[0]).toBe("t1")
    expect(s.ids[s.active]).toBe("t10")
  })

  it("지운 노트의 탭은 빠진다", () => {
    tabs.visitNote("a")
    tabs.visitNote("b")
    tabs.pruneTabs((id) => id !== "a")
    expect(tabs.peekNoteTabs()).toEqual({ ids: ["b"], active: 0 })
  })
})
