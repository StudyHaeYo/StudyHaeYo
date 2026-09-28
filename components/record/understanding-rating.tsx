import { CalendarClock, Gauge } from "lucide-react"
import { reviewDateLabel } from "@/lib/learning-os"

const levels = [1, 2, 3, 4, 5]
const levelHints: Record<number, string> = {
  1: "거의 모르겠어요",
  2: "조금 이해했어요",
  3: "절반 정도 이해했어요",
  4: "대부분 이해했어요",
  5: "완벽히 이해했어요",
}

interface UnderstandingRatingProps {
  value: number | null
  onChange: (value: number) => void
}

export function UnderstandingRating({ value, onChange }: UnderstandingRatingProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
            <Gauge className="size-4" />
          </span>
          <span id="understanding-label" className="text-sm font-medium text-card-foreground">
            이해도
          </span>
        </div>
        <div role="radiogroup" aria-labelledby="understanding-label" className="flex gap-1.5 sm:ml-auto">
          {levels.map((level) => {
            const selected = value === level
            return (
              <button
                key={level}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={`${level}점 - ${levelHints[level]}`}
                onClick={() => onChange(level)}
                className={`flex size-9 items-center justify-center rounded-lg text-sm font-medium transition-colors ${
                  selected
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "border border-border bg-background text-muted-foreground hover:border-indigo-300 hover:text-indigo-700"
                }`}
              >
                {level}
              </button>
            )
          })}
        </div>
      </div>

      {value !== null && (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3 text-xs">
          <span className="text-muted-foreground">{levelHints[value]}</span>
          <span className="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2 py-1 font-medium text-indigo-700 sm:ml-auto">
            <CalendarClock className="size-3" />
            복습 예정 {reviewDateLabel(value)}
          </span>
        </div>
      )}
    </div>
  )
}
