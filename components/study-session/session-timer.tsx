"use client"

import { useEffect, useId, useRef, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Coffee, Play, SkipForward, Square, Timer, X } from "lucide-react"
import { endSession, formatElapsed, startSession, useStudySession } from "@/lib/study-session"
import { useNowEverySecond } from "@/hooks/use-session-clock"
import { useTodayISO } from "@/hooks/use-today"
import { formatDuration } from "@/lib/study-pages"
import { secondaryButton } from "@/components/page-shell"
import { todayMinutes } from "@/lib/study-stats"
import { useSubjectRecordsReady, useWorkspace } from "@/lib/workspace"
import {
  FOCUS_MINUTES,
  LONG_BREAK_EVERY,
  advancePomodoro,
  startPomodoro,
  stopPomodoro,
  usePomodoro,
} from "@/lib/pomodoro"
import { button, menuPanel } from "@/components/ui-styles"

function useElapsed() {
  const { startedAt } = useStudySession()
  const now = useNowEverySecond()
  return { running: startedAt !== null, elapsed: startedAt && now ? now - startedAt : 0, now }
}

// Pomodoro phase with time left, or null when the pomodoro is off.
function usePomodoroClock(now: number | null) {
  const pomodoro = usePomodoro()
  if (!pomodoro.phase || pomodoro.phaseEndsAt === null || pomodoro.phaseStartedAt === null) return null
  const total = pomodoro.phaseEndsAt - pomodoro.phaseStartedAt
  const left = now === null ? total : Math.max(0, pomodoro.phaseEndsAt - now)
  return {
    phase: pomodoro.phase,
    left,
    progress: total > 0 ? 1 - left / total : 1,
    // Which focus block of the set of four we're in (or just finished, during a break).
    round: pomodoro.phase === "focus" ? (pomodoro.completed % LONG_BREAK_EVERY) + 1 : ((pomodoro.completed - 1) % LONG_BREAK_EVERY) + 1,
    completed: pomodoro.completed,
  }
}

// Home: start / stop the session-wide study timer, optionally in pomodoro rhythm (25분 집중 / 5분 휴식).
export function SessionTimerCard() {
  const { running, elapsed, now } = useElapsed()
  const pomodoro = usePomodoroClock(now)
  const onBreak = pomodoro?.phase === "break"
  // Time off notes is recorded to a subject in the summary when the session ends (needs subject records).
  // There is no subject to pick before starting: time on notes is gathered per note on its own.
  const canPickSubject = useSubjectRecordsReady()

  return (
    <section aria-label="학습 타이머" className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 px-5 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className={`flex size-9 shrink-0 items-center justify-center rounded-full ${
              onBreak
                ? "bg-success-100 text-success-700"
                : running
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
            }`}
          >
            {onBreak ? <Coffee className="size-4" aria-hidden="true" /> : <Timer className="size-4" aria-hidden="true" />}
          </span>
          <div className="min-w-0">
            {pomodoro ? (
              <>
                <p className="text-xs text-muted-foreground">
                  {onBreak
                    ? `휴식 중 · 기록 안 함`
                    : `뽀모도로 집중 ${pomodoro.round}/${LONG_BREAK_EVERY}`}
                  {pomodoro.completed > 0 ? ` · 이번 세션 ${pomodoro.completed}번 완료` : ""}
                </p>
                <p className="font-mono text-xl font-semibold tabular-nums text-foreground" aria-live="off">
                  {formatElapsed(pomodoro.left)}
                  <span className="ml-2 font-sans text-xs font-normal text-muted-foreground">
                    남음 · 세션 {formatElapsed(elapsed)}
                  </span>
                </p>
              </>
            ) : running ? (
              <>
                <p className="text-xs text-muted-foreground">공부 중</p>
                <p className="font-mono text-xl font-semibold tabular-nums text-foreground" aria-live="off">
                  {formatElapsed(elapsed)}
                </p>
              </>
            ) : (
              <>
                <p className="text-sm font-semibold text-foreground">공부 타이머</p>
                {/* How time is gathered moved to the button's title: the line under the name says only today's total. */}
                <p className="text-xs text-muted-foreground">
                  <TodayStudied />
                </p>
              </>
            )}
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {pomodoro ? (
            <>
              <button
                type="button"
                onClick={() => advancePomodoro()}
                title={onBreak ? "바로 다음 집중 시작" : "이번 집중을 끝내고 휴식"}
                className={secondaryButton}
              >
                <SkipForward className="size-3.5" aria-hidden="true" />
                {onBreak ? "휴식 건너뛰기" : "지금 쉬기"}
              </button>
              <button type="button" onClick={stopPomodoro} title="뽀모도로만 끄기 · 공부 시간은 계속" className={secondaryButton}>
                <X className="size-3.5" aria-hidden="true" />
                뽀모도로 끄기
              </button>
            </>
          ) : (
            !running && (
              <button type="button" onClick={startPomodoro} title={`${FOCUS_MINUTES}분 집중 · 5분 휴식 반복`} className={secondaryButton}>
                <Timer className="size-3.5" aria-hidden="true" />
                뽀모도로 {FOCUS_MINUTES}분
              </button>
            )
          )}
          {running ? (
            <button type="button" onClick={endSession} className={secondaryButton}>
              <Square className="size-3.5" aria-hidden="true" />
              공부 끝내기
            </button>
          ) : (
            <button
              type="button"
              onClick={startSession}
              title={canPickSubject ? "노트에 머문 시간은 노트별로, 노트 밖 시간은 끝날 때 과목에 기록" : "노트에 머문 시간을 노트별로 자동 기록"}
              className={secondaryButton}
            >
              <Play className="size-3.5" aria-hidden="true" />
              공부 시작
            </button>
          )}
          {running && !pomodoro && (
            <button type="button" onClick={startPomodoro} title={`${FOCUS_MINUTES}분 집중 · 5분 휴식 반복`} className={secondaryButton}>
              <Timer className="size-3.5" aria-hidden="true" />
              뽀모도로로 하기
            </button>
          )}
        </div>
      </div>
      {pomodoro && (
        <div className="h-1 bg-muted" aria-hidden="true">
          <div
            className={`h-full transition-[width] duration-1000 ease-linear ${onBreak ? "bg-success-500" : "bg-primary"}`}
            style={{ width: `${Math.round(pomodoro.progress * 1000) / 10}%` }}
          />
        </div>
      )}
    </section>
  )
}


// "오늘 1시간 20분 공부 · " prefix from today's study records (nothing before the first record).
function TodayStudied() {
  const workspace = useWorkspace()
  const today = useTodayISO()
  const minutes = today ? todayMinutes(workspace, today) : 0
  if (minutes === 0) return <>오늘 공부 기록 없음</>
  return (
    <>
      오늘 <span className="font-medium text-foreground">{formatDuration(minutes)}</span> 공부
    </>
  )
}

// Small "session running" pill; inline in Home's header and a note's top bar, floating on every other page.
// Pressing it opens a small panel where the session can be ended on the spot (2026-11-14): it used to be a link to
// Home, so ending a session meant leaving the note being studied. The summary opens over whatever page this is.
// `withStart` (a note's top bar): before a session runs it shows [공부 시작], so studying a note never needs a trip to
// Home to start the timer (2026-11-15). Home has the full timer card; other pages show the pill only while it runs.
export function SessionIndicator({ floating = false, withStart = false }: { floating?: boolean; withStart?: boolean }) {
  const { running, elapsed, now } = useElapsed()
  const pomodoro = usePomodoroClock(now)
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLSpanElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const panelId = useId()

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return
      setOpen(false)
      buttonRef.current?.focus()
    }
    document.addEventListener("mousedown", onDown)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onDown)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  if (!running) {
    if (!withStart) return null
    return (
      <button
        type="button"
        onClick={startSession}
        title="노트에 머문 시간을 노트별로 기록"
        className={button("secondary", "sm", "max-sm:w-8 max-sm:px-0")}
      >
        <Play className="size-3" aria-hidden="true" />
        {/* A phone's note bar has no room for the words; the icon stays and the name is still read out. */}
        <span className="sr-only sm:not-sr-only">공부 시작</span>
      </button>
    )
  }
  const onBreak = pomodoro?.phase === "break"
  const label = pomodoro ? `${onBreak ? "휴식" : "집중"} ${formatElapsed(pomodoro.left)}` : formatElapsed(elapsed)

  return (
    <span ref={wrapRef} className={`inline-flex ${floating ? "fixed right-4 top-4 z-40 print:hidden" : "relative"}`}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={
          pomodoro
            ? `뽀모도로 ${onBreak ? "휴식" : "집중"} ${formatElapsed(pomodoro.left)} 남음. 눌러서 공부 끝내기 열기`
            : `공부 중, ${formatElapsed(elapsed)} 지남. 눌러서 공부 끝내기 열기`
        }
        className={button("secondary", "sm", "gap-2 rounded-full")}
      >
        {/* A steady dot, not a ping: the pill sits in a note's top bar for the whole session (an hour or more), and a
            loop that long pulls the eye off the text (emil-design-eng · web-design-guidelines, 2026-11-15). */}
        <span className="relative flex size-2" aria-hidden="true">
          <span
            className={`absolute inline-flex size-full rounded-full opacity-60 ${onBreak ? "bg-success-500" : "bg-primary"}`}
          />
          <span className={`relative inline-flex size-2 rounded-full ${onBreak ? "bg-success-500" : "bg-primary"}`} />
        </span>
        <span className="font-mono tabular-nums">{label}</span>
      </button>
      {open && (
        <div
          id={panelId}
          role="group"
          aria-label="공부 타이머"
          className={`${menuPanel} absolute right-0 top-full z-40 mt-2 w-56 origin-top-right p-3`}
        >
          <p className="text-xs text-muted-foreground">
            {pomodoro ? "뽀모도로로 공부하는 중" : "공부하는 중"}
            <span className="ml-1.5 font-mono tabular-nums text-foreground">{formatElapsed(elapsed)}</span>
          </p>
          <button
            type="button"
            onClick={() => {
              setOpen(false)
              endSession()
            }}
            className={`${secondaryButton} mt-2.5 w-full justify-center`}
          >
            <Square className="size-3.5" aria-hidden="true" />
            공부 끝내기
          </button>
          {pathname !== "/" && (
            <Link
              href="/"
              onClick={() => setOpen(false)}
              className="mt-2 block rounded text-center text-xs text-muted-foreground hover:text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-action-500"
            >
              오늘 화면에서 타이머 보기
            </Link>
          )}
        </div>
      )}
    </span>
  )
}
