"use client"

import { useSyncExternalStore } from "react"

export interface SessionSegment {
  pageId: string
  start: number
  end: number
}

export interface FinishedSession {
  id: string
  startedAt: number
  endedAt: number
  segments: SessionSegment[]
  // Pages whose segment time was saved as a study record (so analytics doesn't count it twice).
  recordedPageIds?: string[]
}

export interface RecordPrefill {
  sessionId: string
  pageId: string
  minutes: number
  // Distinguishes repeated prefills for the same page.
  token: number
}

export interface SessionState {
  startedAt: number | null
  segments: SessionSegment[]
  // Open segment on a locked-on page; closed when leaving the page, hiding the tab, or ending the session.
  openSegment: { pageId: string; start: number } | null
  // Finished sessions stay here after the summary modal closes so totals keep counting them.
  log: FinishedSession[]
  summarySessionId: string | null
  prefill: RecordPrefill | null
}

const STORAGE_KEY = "studyhaeyo:study-session"

const idle: SessionState = {
  startedAt: null,
  segments: [],
  openSegment: null,
  log: [],
  summarySessionId: null,
  prefill: null,
}

let state: SessionState | null = null
const listeners = new Set<() => void>()

function load(): SessionState {
  if (state) return state
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    state = raw ? { ...idle, ...(JSON.parse(raw) as Partial<SessionState>) } : idle
  } catch {
    state = idle
  }
  return state
}

function set(update: (prev: SessionState) => SessionState) {
  state = update(load())
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Storage full or disabled: the session still works for this tab.
  }
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

// Server render and hydration both see the idle state; the persisted session is read only on the client.
export function useStudySession(): SessionState {
  return useSyncExternalStore(subscribe, load, () => idle)
}

function closeOpen(s: SessionState, at: number): SessionState {
  if (!s.openSegment) return s
  const segment = { ...s.openSegment, end: at }
  return {
    ...s,
    openSegment: null,
    segments: segment.end > segment.start ? [...s.segments, segment] : s.segments,
  }
}

export function startSession() {
  set((s) => (s.startedAt ? s : { ...s, startedAt: Date.now(), segments: [], openSegment: null }))
}

// Aligns the open segment with the page that should be tracked right now (null = track nothing).
export function syncTrackedPage(pageId: string | null) {
  const s = load()
  if (!s.startedAt) return
  if (s.openSegment?.pageId === pageId) return
  set((prev) => {
    const now = Date.now()
    const closed = closeOpen(prev, now)
    return pageId ? { ...closed, openSegment: { pageId, start: now } } : closed
  })
}

export function endSession() {
  set((s) => {
    if (!s.startedAt) return s
    const now = Date.now()
    const closed = closeOpen(s, now)
    const session: FinishedSession = {
      id: `session-${now}`,
      startedAt: s.startedAt,
      endedAt: now,
      segments: closed.segments,
    }
    return { ...closed, startedAt: null, segments: [], log: [...s.log, session], summarySessionId: session.id }
  })
}

export function openSummary(sessionId: string) {
  set((s) => ({ ...s, summarySessionId: sessionId }))
}

export function closeSummary() {
  set((s) => ({ ...s, summarySessionId: null }))
}

export function requestRecordPrefill(sessionId: string, pageId: string, minutes: number) {
  set((s) => ({ ...s, summarySessionId: null, prefill: { sessionId, pageId, minutes, token: Date.now() } }))
}

export function clearRecordPrefill(recorded = false) {
  set((s) => {
    if (!s.prefill) return s
    const { sessionId, pageId } = s.prefill
    const log = recorded
      ? s.log.map((session) =>
          session.id === sessionId
            ? { ...session, recordedPageIds: [...new Set([...(session.recordedPageIds ?? []), pageId])] }
            : session,
        )
      : s.log
    return { ...s, log, prefill: null }
  })
}

// Segment time from finished sessions that has not been saved as a study record yet.
export function unrecordedSessionMinutes(log: FinishedSession[]) {
  let ms = 0
  for (const session of log) {
    const recorded = new Set(session.recordedPageIds ?? [])
    for (const seg of session.segments) if (!recorded.has(seg.pageId)) ms += seg.end - seg.start
  }
  return Math.round(ms / 60_000)
}

export function sessionDurationMs(session: Pick<FinishedSession, "startedAt" | "endedAt">) {
  return Math.max(0, session.endedAt - session.startedAt)
}

export function totalsByPage(segments: SessionSegment[]) {
  const totals = new Map<string, number>()
  for (const seg of segments) totals.set(seg.pageId, (totals.get(seg.pageId) ?? 0) + (seg.end - seg.start))
  return [...totals.entries()].map(([pageId, ms]) => ({ pageId, ms })).sort((a, b) => b.ms - a.ms)
}

export function msToMinutes(ms: number) {
  return Math.max(1, Math.round(ms / 60_000))
}

export function formatElapsed(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const sec = total % 60
  const pad = (n: number) => String(n).padStart(2, "0")
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`
}

export function formatDuration(ms: number) {
  const minutes = Math.round(ms / 60_000)
  if (minutes < 1) return "1분 미만"
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h > 0 ? (m > 0 ? `${h}시간 ${m}분` : `${h}시간`) : `${m}분`
}
