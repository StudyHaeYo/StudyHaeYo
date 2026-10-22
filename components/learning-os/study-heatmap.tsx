"use client"

import { Flame } from "lucide-react"
import { useTodayISO } from "@/hooks/use-today"
import { formatDate, formatDuration } from "@/lib/study-pages"
import { studyCalendar, studyStreak, type StudyDay } from "@/lib/study-stats"
import { useWorkspace } from "@/lib/workspace"

const WEEKS = 12
const DAY_LABELS = ["월", "", "수", "", "금", "", ""]

// Study minutes → one of five shades (0, <30, <60, <120, 120+ minutes).
function shade(day: StudyDay) {
  if (day.future) return "bg-transparent"
  if (day.minutes === 0) return "bg-muted"
  if (day.minutes < 30) return "bg-indigo-200"
  if (day.minutes < 60) return "bg-indigo-300"
  if (day.minutes < 120) return "bg-indigo-500"
  return "bg-indigo-700"
}

// The next small goal for the streak.
function streakMessage({ current, best, studiedToday }: { current: number; best: number; studiedToday: boolean }) {
  if (!studiedToday) {
    if (current === 0) return "오늘 학습 기록을 남기면 연속 학습이 시작돼요."
    return current + 1 > best ? `오늘 기록을 남기면 ${current + 1}일 연속, 신기록이에요!` : `오늘 기록을 남기면 ${current + 1}일 연속이에요.`
  }
  return current >= best ? `내일도 공부하면 ${current + 1}일 연속, 신기록이에요!` : `내일도 공부하면 ${current + 1}일 연속이에요.`
}

// 학습 잔디: the last 12 weeks of study time, plus the current and best streak of study days.
export function StudyHeatmap() {
  const workspace = useWorkspace()
  const today = useTodayISO()
  const weeks = today ? studyCalendar(workspace, today, WEEKS) : null
  const streak = today ? studyStreak(workspace, today) : null
  const studiedDays = weeks?.flat().filter((d) => d.minutes > 0).length ?? 0

  return (
    <section aria-labelledby="study-heatmap-title" className="rounded-xl border border-border bg-card p-5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 id="study-heatmap-title" className="text-[15px] font-semibold text-foreground">
            학습 잔디
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">최근 {WEEKS}주 · 공부한 날 {studiedDays}일</p>
        </div>
        {streak && (
          <div className="text-right">
            <p
              className={`inline-flex items-center gap-1 text-sm font-semibold ${
                streak.current > 0 ? "text-orange-600" : "text-muted-foreground"
              }`}
            >
              <Flame className="size-4" aria-hidden="true" />
              {streak.current}일 연속
            </p>
            <p className="text-xs text-muted-foreground">최고 {streak.best}일</p>
          </div>
        )}
      </div>

      {weeks === null ? (
        <div className="h-[104px] animate-pulse rounded-lg bg-muted" aria-hidden="true" />
      ) : (
        <div className="flex gap-1" role="img" aria-label={`최근 ${WEEKS}주 동안 ${studiedDays}일 공부했어요`}>
          <div className="mr-0.5 grid grid-rows-7 gap-1 text-[10px] leading-3 text-muted-foreground" aria-hidden="true">
            {DAY_LABELS.map((label, i) => (
              <span key={i} className="h-3">
                {label}
              </span>
            ))}
          </div>
          {weeks.map((week) => (
            <div key={week[0].date} className="grid flex-1 grid-rows-7 gap-1">
              {week.map((day) => (
                <span
                  key={day.date}
                  title={day.future ? undefined : `${formatDate(day.date)} · ${day.minutes > 0 ? formatDuration(day.minutes) : "기록 없음"}`}
                  className={`h-3 rounded-[3px] ${shade(day)} ${day.date === today ? "ring-1 ring-foreground/40" : ""}`}
                />
              ))}
            </div>
          ))}
        </div>
      )}

      {streak && <p className="mt-3 text-xs text-orange-600">{streakMessage(streak)}</p>}
      <div className="mt-3 flex items-center justify-end gap-1 text-[10px] text-muted-foreground" aria-hidden="true">
        적게
        {["bg-muted", "bg-indigo-200", "bg-indigo-300", "bg-indigo-500", "bg-indigo-700"].map((c) => (
          <span key={c} className={`size-2.5 rounded-[2px] ${c}`} />
        ))}
        많이
      </div>
    </section>
  )
}
