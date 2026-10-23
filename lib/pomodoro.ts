"use client"

import { useSyncExternalStore } from "react"
import { startSession } from "@/lib/study-session"

// 뽀모도로: 25분 집중 → 5분 휴식, 집중 4번마다 15분 휴식. It rides on the study session (starting one
// starts the session); during a break the session tracker stops recording note time (R4, R14).
// Browser-only like the session itself: nothing goes to the DB.

export const FOCUS_MINUTES = 25
export const SHORT_BREAK_MINUTES = 5
export const LONG_BREAK_MINUTES = 15
export const LONG_BREAK_EVERY = 4

export type PomodoroPhase = "focus" | "break"

export interface PomodoroState {
  phase: PomodoroPhase | null
  phaseStartedAt: number | null
  phaseEndsAt: number | null
  // Focus blocks finished in this run (the 4th one earns the long break).
  completed: number
}

const STORAGE_KEY = "studyhaeyo:pomodoro"
const off: PomodoroState = { phase: null, phaseStartedAt: null, phaseEndsAt: null, completed: 0 }

let state: PomodoroState | null = null
const listeners = new Set<() => void>()

function load(): PomodoroState {
  if (state) return state
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    state = raw ? { ...off, ...(JSON.parse(raw) as Partial<PomodoroState>) } : off
  } catch {
    state = off
  }
  return state
}

function set(next: PomodoroState) {
  state = next
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // Storage unavailable: the timer still works in this tab.
  }
  for (const listener of listeners) listener()
}

function handleStorage(e: StorageEvent) {
  if (e.key !== STORAGE_KEY) return
  state = null
  load()
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void) {
  if (listeners.size === 0) window.addEventListener("storage", handleStorage)
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) window.removeEventListener("storage", handleStorage)
  }
}

// Server render and hydration see "off"; the saved timer is read only on the client.
export function usePomodoro(): PomodoroState {
  return useSyncExternalStore(subscribe, load, () => off)
}

function phaseAt(phase: PomodoroPhase, minutes: number, completed: number, now = Date.now()): PomodoroState {
  return { phase, phaseStartedAt: now, phaseEndsAt: now + minutes * 60_000, completed }
}

export function breakMinutesAfter(completed: number) {
  return completed > 0 && completed % LONG_BREAK_EVERY === 0 ? LONG_BREAK_MINUTES : SHORT_BREAK_MINUTES
}

export function startPomodoro() {
  startSession()
  set(phaseAt("focus", FOCUS_MINUTES, 0))
}

export function stopPomodoro() {
  set(off)
}

// Ends the current phase now and moves to the next one (also what the timer does when time is up).
// Returns the phase that just started.
export function advancePomodoro(now = Date.now()): PomodoroPhase | null {
  const s = load()
  if (!s.phase) return null
  if (s.phase === "focus") {
    const completed = s.completed + 1
    set(phaseAt("break", breakMinutesAfter(completed), completed, now))
    return "break"
  }
  set(phaseAt("focus", FOCUS_MINUTES, s.completed, now))
  return "focus"
}

// Called by the timer when a phase may be over. Several tabs can see the same deadline; only the
// first one to act on it advances (the others find a different phaseEndsAt).
export function advanceIfDue(expectedEndsAt: number, now = Date.now()): PomodoroPhase | null {
  const s = load()
  if (!s.phase || s.phaseEndsAt !== expectedEndsAt || now < expectedEndsAt) return null
  return advancePomodoro(now)
}

// Short two-tone chime for phase changes (no audio file to ship). Silently does nothing if blocked.
export function chime() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx()
    ;[880, 660].forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.frequency.value = freq
      const at = ctx.currentTime + i * 0.25
      gain.gain.setValueAtTime(0.0001, at)
      gain.gain.exponentialRampToValueAtTime(0.2, at + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.22)
      osc.connect(gain).connect(ctx.destination)
      osc.start(at)
      osc.stop(at + 0.24)
    })
    window.setTimeout(() => void ctx.close(), 800)
  } catch {
    // Audio not allowed; the toast still shows.
  }
}
