"use client"

import { useTodayISO } from "@/hooks/use-today"
import { formatDate, formatDuration } from "@/lib/study-pages"
import { studyCalendar, studyStreak, type StudyDay } from "@/lib/study-stats"
import { useWorkspace } from "@/lib/workspace"

const WEEKS = 5
const DAY_NAMES = ["월", "화", "수", "목", "금", "토", "일"]

// Study minutes → one of five shades (0, <30, <60, <120, 120+ minutes).
function shade(day: StudyDay) {
  if (day.future) return "bg-transparent text-muted-foreground/40"
  if (day.minutes === 0) return "bg-muted text-muted-foreground"
  if (day.minutes < 30) return "bg-indigo-100 text-indigo-900"
  if (day.minutes < 60) return "bg-indigo-200 text-indigo-900"
  if (day.minutes < 120) return "bg-indigo-400 text-white"
  return "bg-indigo-600 text-white"
}

// 학습 달력: the last five weeks laid out like a calendar (월~일 across, a week per row), each day shaded by
// study time. Streaks are shown as a plain fact, not a goal to chase (design A).
export function StudyHeatmap() {
  const workspace = useWorkspace()
  const today = useTodayISO()
  const weeks = today ? studyCalendar(workspace, today, WEEKS) : null
  const streak = today ? studyStreak(workspace, today) : null
  const studiedDays = weeks?.flat().filter((d) => d.minutes > 0).length ?? 0

  return (
    <section aria-labelledby="study-heatmap-title">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 id="study-heatmap-title" className="text-base font-semibold text-foreground">
          학습 달력
        </h2>
        <p className="text-xs text-muted-foreground">
          {`최근 ${WEEKS}주 · ${studiedDays}일 공부`}
          {streak && streak.current > 0 ? ` · ${streak.current}일 연속` : ""}
        </p>
      </div>

      {weeks === null ? (
        <div className="h-48 animate-pulse rounded-lg bg-muted" aria-hidden="true" />
      ) : (
        <div role="img" aria-label={`최근 ${WEEKS}주 동안 ${studiedDays}일 공부했어요`}>
          <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[11px] text-muted-foreground" aria-hidden="true">
            {DAY_NAMES.map((name) => (
              <span key={name}>{name}</span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {weeks.flat().map((day) => (
              <span
                key={day.date}
                title={day.future ? undefined : `${formatDate(day.date)} · ${day.minutes > 0 ? formatDuration(day.minutes) : "기록 없음"}`}
                className={`flex aspect-square items-center justify-center rounded-md text-[11px] tabular-nums ${shade(day)} ${
                  day.date === today ? "ring-2 ring-foreground/70 ring-offset-1 ring-offset-background" : ""
                }`}
              >
                {Number(day.date.slice(8))}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="mt-2 flex items-center justify-end gap-1 text-[10px] text-muted-foreground" aria-hidden="true">
        적게
        {["bg-muted", "bg-indigo-100", "bg-indigo-200", "bg-indigo-400", "bg-indigo-600"].map((c) => (
          <span key={c} className={`size-2.5 rounded-[2px] ${c}`} />
        ))}
        많이
      </div>
    </section>
  )
}
