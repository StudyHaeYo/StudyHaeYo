"use client"

import Link from "next/link"
import { Play, Square, Timer } from "lucide-react"
import { endSession, formatElapsed, startSession, useStudySession } from "@/lib/study-session"
import { useNowEverySecond } from "@/hooks/use-session-clock"
import { useTodayISO } from "@/hooks/use-today"
import { formatDuration } from "@/lib/study-pages"
import { todayMinutes } from "@/lib/study-stats"
import { useWorkspace } from "@/lib/workspace"

function useElapsed() {
  const { startedAt } = useStudySession()
  const now = useNowEverySecond()
  return { running: startedAt !== null, elapsed: startedAt && now ? now - startedAt : 0 }
}

// Home: start / stop the session-wide study timer.
export function SessionTimerCard() {
  const { running, elapsed } = useElapsed()

  return (
    <section
      aria-label="학습 타이머"
      className="mb-6 flex items-center justify-between gap-4 rounded-xl border border-border bg-card px-5 py-4"
    >
      <div className="flex min-w-0 items-center gap-3">
        <span
          className={`flex size-9 shrink-0 items-center justify-center rounded-full ${
            running ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
          }`}
        >
          <Timer className="size-4" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          {running ? (
            <>
              <p className="text-xs text-muted-foreground">학습 세션 진행 중</p>
              <p className="font-mono text-xl font-semibold tabular-nums text-foreground" aria-live="off">
                {formatElapsed(elapsed)}
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-medium text-foreground">학습 세션</p>
              <p className="text-xs leading-relaxed text-muted-foreground text-pretty">
                <TodayStudied />학습 노트에 머문 시간이 페이지별로 자동 기록돼요
              </p>
            </>
          )}
        </div>
      </div>
      {running ? (
        <button
          type="button"
          onClick={endSession}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
        >
          <Square className="size-3.5" aria-hidden="true" />
          학습 종료
        </button>
      ) : (
        <button
          type="button"
          onClick={startSession}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
        >
          <Play className="size-3.5" aria-hidden="true" />
          학습 시작
        </button>
      )}
    </section>
  )
}

// "오늘 1시간 20분 공부 · " prefix from today's study records (nothing before the first record).
function TodayStudied() {
  const workspace = useWorkspace()
  const today = useTodayISO()
  const minutes = today ? todayMinutes(workspace, today) : 0
  if (minutes === 0) return null
  return (
    <>
      오늘 <span className="font-medium text-foreground">{formatDuration(minutes)}</span> 공부 ·{" "}
    </>
  )
}

// Small "session running" pill; inline in Home's TopBar, floating on every other page.
export function SessionIndicator({ floating = false }: { floating?: boolean }) {
  const { running, elapsed } = useElapsed()
  if (!running) return null

  return (
    <Link
      href="/"
      aria-label={`학습 세션 진행 중, ${formatElapsed(elapsed)} 경과. 홈에서 종료하기`}
      className={`inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-foreground transition-colors hover:bg-accent ${
        floating ? "fixed right-4 top-4 z-40" : ""
      }`}
    >
      <span className="relative flex size-2" aria-hidden="true">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-60" />
        <span className="relative inline-flex size-2 rounded-full bg-primary" />
      </span>
      <span className="font-mono tabular-nums">{formatElapsed(elapsed)}</span>
    </Link>
  )
}
