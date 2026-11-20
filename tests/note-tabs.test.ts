import { beforeEach, describe, expect, it, vi } from "vitest"

// 노트 탭 (D-45): moving to a note changes the tab you are on; only "new tab" adds one.
type Tabs = typeof import("@/lib/note-tabs")
let tabs: Tabs
beforeEach(async () => {
  vi.resetModules()
  tabs = await import("@/lib/note-tabs")
})

describe("노트 탭", () => {
  it("다른 노트로 가면 지금 탭이 바뀌고, 새 탭으로 열면 옆에 생긴다", () => {
    tabs.visitNote("a")
    tabs.visitNote("b")
    expect(tabs.peekNoteTabs()).toEqual({ ids: ["b"], active: 0 })
    tabs.openInNewTab("c")
    expect(tabs.peekNoteTabs()).toEqual({ ids: ["b", "c"], active: 1 })
    tabs.visitNote("c")
    expect(tabs.peekNoteTabs()).toEqual({ ids: ["b", "c"], active: 1 })
    // already open in another tab: go to that tab, no second tab for the same note
    tabs.visitNote("b")
    expect(tabs.peekNoteTabs()).toEqual({ ids: ["b", "c"], active: 0 })
  })

  it("보던 탭을 닫으면 오른쪽(없으면 왼쪽) 탭을 보여 준다", () => {
    tabs.visitNote("a")
    tabs.openInNewTab("b")
    tabs.openInNewTab("c")
    tabs.visitNote("b") // active: b (index 1)
    expect(tabs.closeTab(1)).toBe("c")
    expect(tabs.peekNoteTabs()).toEqual({ ids: ["a", "c"], active: 1 })
    expect(tabs.closeTab(1)).toBe("a")
    expect(tabs.closeTab(0)).toBeNull()
  })

  it("+로 만든 새 노트는 새 탭에 열린다", () => {
    tabs.visitNote("a")
    tabs.openNewNoteInNewTab()
    tabs.visitNote("new")
    expect(tabs.peekNoteTabs()).toEqual({ ids: ["a", "new"], active: 1 })
  })

  it("열 개가 넘으면 보고 있지 않은 왼쪽 탭부터 닫힌다", () => {
    tabs.visitNote("t0")
    for (let i = 1; i <= 10; i++) tabs.openInNewTab(`t${i}`)
    const s = tabs.peekNoteTabs()
    expect(s.ids).toHaveLength(10)
    expect(s.ids[0]).toBe("t1")
    expect(s.ids[s.active]).toBe("t10")
  })

  it("지운 노트의 탭은 빠진다", () => {
    tabs.visitNote("a")
    tabs.openInNewTab("b")
    tabs.pruneTabs((id) => id !== "a")
    expect(tabs.peekNoteTabs()).toEqual({ ids: ["b"], active: 0 })
  })
})
