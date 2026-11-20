"use client"

import { useEffect } from "react"
import { toast } from "sonner"
import { advanceIfDue, breakMinutesAfter, chime, FOCUS_MINUTES, LONG_BREAK_EVERY, stopPomodoro, usePomodoro } from "@/lib/pomodoro"
import { useStudySession } from "@/lib/study-session"

// Mounted once in the layout: moves the pomodoro to its next phase on time (on any page) and turns it
// off when the study session ends.
export function PomodoroDriver() {
  const pomodoro = usePomodoro()
  const { startedAt } = useStudySession()

  useEffect(() => {
    if (pomodoro.phase && !startedAt) stopPomodoro()
  }, [pomodoro.phase, startedAt])

  useEffect(() => {
    const endsAt = pomodoro.phaseEndsAt
    if (!pomodoro.phase || endsAt === null) return
    const fire = () => {
      const next = advanceIfDue(endsAt)
      if (!next) return
      chime()
      if (next === "break") {
        const done = pomodoro.completed + 1
        toast.success(`집중 ${FOCUS_MINUTES}분 끝 · ${breakMinutesAfter(done)}분 휴식`, {
          description: "휴식 시간은 학습 시간에서 제외",
        })
      } else {
        toast(`다시 집중 (${(pomodoro.completed % LONG_BREAK_EVERY) + 1}/${LONG_BREAK_EVERY})`)
      }
    }
    const id = window.setTimeout(fire, Math.max(0, endsAt - Date.now()))
    // Background tabs may delay timers; check again when the tab comes back.
    const onVisible = () => {
      if (document.visibilityState === "visible") fire()
    }
    document.addEventListener("visibilitychange", onVisible)
    return () => {
      window.clearTimeout(id)
      document.removeEventListener("visibilitychange", onVisible)
    }
  }, [pomodoro.phase, pomodoro.phaseEndsAt, pomodoro.completed])

  return null
}
