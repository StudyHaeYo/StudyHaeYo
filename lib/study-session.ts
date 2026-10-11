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
  // Ended on load because the tab had been inactive too long; endedAt is the last activity time.
  autoEnded?: boolean
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
  // Heartbeat while a session runs and the tab is visible; used to close stale segments after a reload.
  lastActiveAt: number | null
  // Finished sessions stay here after the summary modal closes so totals keep counting them.
  log: FinishedSession[]
  summarySessionId: string | null
  prefill: RecordPrefill | null
}

interface TimedRecord {
  id: string
  pageId: string
  createdAt?: number
}

const STORAGE_KEY = "studyhaeyo:study-session"
export const HEARTBEAT_MS = 30_000
const STALE_SESSION_MS = 30 * 60_000

const idle: SessionState = {
  startedAt: null,
  segments: [],
  openSegment: null,
  lastActiveAt: null,
  log: [],
  summarySessionId: null,
  prefill: null,
}

let state: SessionState | null = null
let recovered = false
const listeners = new Set<() => void>()

function parse(raw: string | null): SessionState {
  if (!raw) return idle
  try {
    return { ...idle, ...(JSON.parse(raw) as Partial<SessionState>) }
  } catch {
    return idle
  }
}

function load(): SessionState {
  if (state) return state
  try {
    state = parse(window.localStorage.getItem(STORAGE_KEY))
  } catch {
    state = idle
  }
  return state
}

function notify() {
  for (const listener of listeners) listener()
}

function set(update: (prev: SessionState) => SessionState) {
  const prev = load()
  const next = update(prev)
  if (next === prev) return
  state = next
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Storage full or disabled: the session still works for this tab.
  }
  notify()
}

// Another tab wrote the session: adopt it instead of overwriting it with this tab's stale copy.
function handleStorage(e: StorageEvent) {
  if (e.key !== STORAGE_KEY) return
  state = parse(e.newValue)
  notify()
}

function subscribe(listener: () => void) {
  if (listeners.size === 0) window.addEventListener("storage", handleStorage)
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) window.removeEventListener("storage", handleStorage)
  }
}

// Server render and hydration both see the idle state; the persisted session is read only on the client.
export function useStudySession(): SessionState {
  return useSyncExternalStore(subscribe, load, () => idle)
}

function closeOpen(s: SessionState, at: number): SessionState {
  if (!s.openSegment) return s
  const segment = { ...s.openSegment, end: Math.max(at, s.openSegment.start) }
  return {
    ...s,
    openSegment: null,
    segments: segment.end > segment.start ? [...s.segments, segment] : s.segments,
  }
}

function finish(s: SessionState, at: number, autoEnded = false): SessionState {
  if (!s.startedAt) return s
  const closed = closeOpen(s, at)
  const endedAt = Math.max(at, s.startedAt)
  const session: FinishedSession = {
    id: `session-${endedAt}`,
    startedAt: s.startedAt,
    endedAt,
    segments: closed.segments,
    ...(autoEnded ? { autoEnded } : {}),
  }
  return {
    ...closed,
    startedAt: null,
    segments: [],
    lastActiveAt: null,
    log: [...s.log, session],
    summarySessionId: session.id,
  }
}

function lastKnownActivity(s: SessionState) {
  return Math.max(s.lastActiveAt ?? 0, s.startedAt ?? 0, s.openSegment?.start ?? 0, ...s.segments.map((seg) => seg.end))
}

// Runs once per page load, after mount: a segment left open by a closed or crashed tab ends at the
// last heartbeat (not "now"), and a session idle for 30+ minutes ends at that time too.
export function recoverStaleSession() {
  if (recovered) return
  recovered = true
  set((s) => {
    if (!s.startedAt && !s.openSegment) return s
    const lastActive = lastKnownActivity(s)
    const closed = closeOpen(s, lastActive)
    if (closed.startedAt && Date.now() - lastActive >= STALE_SESSION_MS) return finish(closed, lastActive, true)
    return closed === s ? s : { ...closed, lastActiveAt: lastActive }
  })
}

export function startSession() {
  recoverStaleSession()
  set((s) => {
    if (s.startedAt) return s
    const now = Date.now()
    return { ...s, startedAt: now, segments: [], openSegment: null, lastActiveAt: now }
  })
}

function track(s: SessionState, pageId: string | null, now: number): SessionState {
  if (s.openSegment && s.openSegment.pageId === pageId) return s
  const closed = closeOpen(s, now)
  return pageId ? { ...closed, openSegment: { pageId, start: now } } : closed
}

// Aligns the open segment with the page that should be tracked right now (null = track nothing).
export function syncTrackedPage(pageId: string | null) {
  recoverStaleSession()
  set((s) => {
    if (!s.startedAt) return s
    const now = Date.now()
    const next = track(s, pageId, now)
    return next === s ? s : { ...next, lastActiveAt: now }
  })
}

// Every 30s while visible: records activity and re-opens tracking if another tab closed the segment.
export function heartbeat(pageId: string | null) {
  set((s) => {
    if (!s.startedAt) return s
    const now = Date.now()
    return { ...track(s, pageId, now), lastActiveAt: now }
  })
}

// pagehide / tab hidden: close the open segment at this moment.
export function suspendTracking() {
  set((s) => {
    if (!s.startedAt) return s
    const now = Date.now()
    return { ...closeOpen(s, now), lastActiveAt: now }
  })
}

export function endSession() {
  recoverStaleSession()
  set((s) => finish(s, Date.now()))
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

export function clearRecordPrefill() {
  set((s) => (s.prefill ? { ...s, prefill: null } : s))
}

// Records made before createdAt existed carry their creation time in the id (`<pageId>-r-<ms>`).
export function recordCreatedAt(record: TimedRecord): number | null {
  if (typeof record.createdAt === "number") return record.createdAt
  const match = record.id.match(/-r-(\d{12,})$/)
  return match ? Number(match[1]) : null
}

export function hasRecordInWindow(records: TimedRecord[], pageId: string, from: number, to: number) {
  return records.some((r) => {
    if (r.pageId !== pageId) return false
    const at = recordCreatedAt(r)
    return at !== null && at >= from && at <= to
  })
}

// Session time not yet captured by a study record. A page's time in a session is dropped as soon as
// any record for that page was created during the session (summary button, review, or manual add);
// that record's own minutes are what counts, even if the user lowered the prefilled value.
export function unrecordedSessionMinutes(s: SessionState, records: TimedRecord[], now: number) {
  const windows: { startedAt: number; endedAt: number; segments: SessionSegment[] }[] = [...s.log]
  if (s.startedAt) {
    const live = s.openSegment ? [...s.segments, { ...s.openSegment, end: Math.max(now, s.openSegment.start) }] : s.segments
    windows.push({ startedAt: s.startedAt, endedAt: now, segments: live })
  }
  let ms = 0
  for (const session of windows) {
    for (const { pageId, ms: pageMs } of totalsByPage(session.segments)) {
      if (!hasRecordInWindow(records, pageId, session.startedAt, session.endedAt)) ms += pageMs
    }
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
