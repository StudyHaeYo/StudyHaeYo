import { BarChart3 } from "lucide-react"
import type { CategoryStat } from "@/lib/types"

interface StatsWidgetProps {
  stats: CategoryStat[]
  goal: { current: number; target: number }
}

export function StatsWidget({ stats, goal }: StatsWidgetProps) {
  const max = Math.max(...stats.map((s) => s.count), 1)
  const percent = Math.min(Math.round((goal.current / goal.target) * 100), 100)

  // circular progress geometry
  const radius = 40
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (percent / 100) * circumference

  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-card-foreground">
        <BarChart3 className="size-4 text-indigo-600" />
        이번 주 학습 통계
      </h2>

      {/* Bar chart */}
      <ul className="space-y-3">
        {stats.map((stat) => (
          <li key={stat.category}>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="font-medium text-foreground">
                {stat.category}
              </span>
              <span className="text-muted-foreground">{stat.count}개</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-indigo-600 transition-all"
                style={{ width: `${(stat.count / max) * 100}%` }}
              />
            </div>
          </li>
        ))}
      </ul>

      {/* Circular progress */}
      <div className="mt-6 flex flex-col items-center border-t border-border pt-5">
        <p className="mb-3 text-xs font-medium text-muted-foreground">
          이번 주 목표 달성률
        </p>
        <div className="relative flex items-center justify-center">
          <svg width="110" height="110" className="-rotate-90">
            <circle
              cx="55"
              cy="55"
              r={radius}
              fill="none"
              strokeWidth="10"
              className="stroke-muted"
            />
            <circle
              cx="55"
              cy="55"
              r={radius}
              fill="none"
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              className="stroke-indigo-600 transition-all duration-500"
            />
          </svg>
          <div className="absolute flex flex-col items-center">
            <span className="text-2xl font-semibold text-foreground">
              {percent}%
            </span>
            <span className="text-xs text-muted-foreground">
              {goal.current}/{goal.target}
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}
