import { SessionIndicator } from "@/components/study-session/session-timer"

interface TopBarProps {
  date: string
}

export function TopBar({ date }: TopBarProps) {
  return (
    <header className="flex items-start justify-between gap-4 pb-6">
      <div>
        <p className="text-sm text-muted-foreground">{date}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
          오늘의 학습 현황
        </h1>
      </div>
      <SessionIndicator />
    </header>
  )
}
