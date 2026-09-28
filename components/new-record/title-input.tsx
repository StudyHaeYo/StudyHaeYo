"use client"

interface TitleInputProps {
  value: string
  onChange: (value: string) => void
}

export function TitleInput({ value, onChange }: TitleInputProps) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="오늘 무엇을 공부했나요?"
      aria-label="제목"
      className="w-full border-b-2 border-border bg-transparent pb-3 text-2xl font-semibold tracking-tight text-foreground outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-indigo-500"
    />
  )
}
