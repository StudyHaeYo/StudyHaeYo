import { useSyncExternalStore } from "react"

// 노트 탭 (D-45): open notes as tabs above the note, the Notion way — going to another note changes the tab you are
// on; only "open in a new tab" (Ctrl/⌘ + click, middle click, ⋯ > 새 탭으로 열기, the tab bar's +) adds one.
// Kept in this browser only (localStorage): which notes someone has open is a per-device convenience, not study data,
// so nothing is saved to the DB. A read that fails (private window, blocked storage) just starts with no tabs.

export interface NoteTabsState {
  ids: string[] // page ids, left to right
  active: number // index into ids
}

const KEY = "studyhaeyo:note-tabs"
const MAX_TABS = 10
const EMPTY: NoteTabsState = { ids: [], active: 0 }

let state: NoteTabsState = EMPTY
let loaded = false
// Set by openNewNoteInNewTab: the next note opened (the one /new creates) goes into a new tab.
let nextIsNewTab = false
const listeners = new Set<() => void>()

function load() {
  if (loaded) return
  loaded = true
  try {
    const raw = window.localStorage.getItem(KEY)
    const parsed = raw ? (JSON.parse(raw) as Partial<NoteTabsState>) : null
    if (parsed && Array.isArray(parsed.ids) && parsed.ids.every((id) => typeof id === "string")) {
      const ids = parsed.ids.slice(0, MAX_TABS)
      const active =
        typeof parsed.active === "number" ? Math.min(Math.max(0, parsed.active), Math.max(0, ids.length - 1)) : 0
      state = { ids, active }
    }
  } catch {
    // no storage: start empty
  }
}

function set(next: NoteTabsState) {
  state = next
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    // no storage: tabs last until the page is reloaded
  }
  listeners.forEach((l) => l())
}

function subscribe(listener: () => void) {
  load()
  listeners.add(listener)
  return () => listeners.delete(listener)
}

// The server and the first client render see no tabs (EMPTY), so hydration matches; the saved tabs come right after.
export function useNoteTabs(): NoteTabsState {
  return useSyncExternalStore(
    subscribe,
    () => {
      load()
      return state
    },
    () => EMPTY,
  )
}

// Too many tabs: drop the leftmost ones that aren't the active tab.
function capped(ids: string[], active: number): NoteTabsState {
  let next = [...ids]
  let at = active
  while (next.length > MAX_TABS) {
    const drop = at === 0 ? 1 : 0
    next.splice(drop, 1)
    if (drop < at) at -= 1
  }
  return { ids: next, active: at }
}

// The current tabs without subscribing (tests).
export function peekNoteTabs(): NoteTabsState {
  load()
  return state
}

// Called by the note screen whenever the note shown changes.
export function visitNote(pageId: string) {
  load()
  const { ids, active } = state
  const at = ids.indexOf(pageId)
  if (nextIsNewTab) {
    nextIsNewTab = false
    if (at === -1)
      return set(capped([...ids.slice(0, active + 1), pageId, ...ids.slice(active + 1)], ids.length ? active + 1 : 0))
  }
  if (ids.length === 0) return set({ ids: [pageId], active: 0 })
  // Already open in some tab: go to that tab (no second tab for the same note).
  if (at !== -1) return at === active ? undefined : set({ ids, active: at })
  // Otherwise the tab you are on now shows this note.
  set({ ids: ids.map((id, i) => (i === active ? pageId : id)), active })
}

// Ctrl/⌘ + click, middle click or ⋯ > 새 탭으로 열기 on a note: a tab right after the current one (or that note's tab
// if it is open already). The caller then navigates to the note.
export function openInNewTab(pageId: string) {
  load()
  const { ids, active } = state
  const at = ids.indexOf(pageId)
  if (at !== -1) return set({ ids, active: at })
  if (ids.length === 0) return set({ ids: [pageId], active: 0 })
  set(capped([...ids.slice(0, active + 1), pageId, ...ids.slice(active + 1)], active + 1))
}

// The tab bar's +: the note /new is about to create opens in a new tab.
export function openNewNoteInNewTab() {
  nextIsNewTab = true
}

// Closes a tab. Returns the note to show next when the closed tab was the one being looked at (the tab to its right,
// else to its left), null when no tab is left, and undefined when nothing needs to change on screen.
export function closeTab(index: number): string | null | undefined {
  load()
  const { ids, active } = state
  if (index < 0 || index >= ids.length) return undefined
  const rest = ids.filter((_, i) => i !== index)
  if (rest.length === 0) {
    set(EMPTY)
    return null
  }
  if (index === active) {
    const nextActive = Math.min(index, rest.length - 1)
    set({ ids: rest, active: nextActive })
    return rest[nextActive]
  }
  set({ ids: rest, active: index < active ? active - 1 : active })
  return undefined
}

// Notes deleted elsewhere (another tab, the sidebar) lose their tab.
export function pruneTabs(exists: (id: string) => boolean) {
  load()
  const { ids, active } = state
  if (ids.every(exists)) return
  const activeId = ids[active]
  const kept = ids.filter(exists)
  const at = kept.indexOf(activeId)
  set({ ids: kept, active: at === -1 ? Math.max(0, Math.min(active, kept.length - 1)) : at })
}

// A click that should open in a new tab: Ctrl/⌘ + click or the middle button.
export function wantsNewTab(e: { ctrlKey: boolean; metaKey: boolean; button: number }) {
  return e.ctrlKey || e.metaKey || e.button === 1
}
