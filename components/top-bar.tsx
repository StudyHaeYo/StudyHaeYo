interface TopBarProps {
  date: string
}

export function TopBar({ date }: TopBarProps) {
  return (
    <header className="pb-6">
      <p className="text-sm text-muted-foreground">{date}</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
        오늘의 학습 현황
      </h1>
    </header>
  )
}
