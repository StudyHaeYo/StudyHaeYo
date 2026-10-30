"use client"

import { Sparkles } from "lucide-react"
import { pageStarters } from "@/lib/templates"

// Shown on a page whose body is still empty: pick what the page starts with, or just start typing
// (the row goes away as soon as the body has anything in it). AI isn't a template — it fills the page
// from the title, so it sits apart at the end.
export function PageStarters({ onPick, onAi }: { onPick: (starterId: string) => void; onAi: () => void }) {
  const starters = pageStarters.filter((s) => s.id !== "blank" && s.id !== "ai")
  const chip =
    "inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-sm text-foreground transition-colors hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"

  return (
    <section aria-label="페이지 시작하기" className="mt-6 flex flex-col gap-2.5 print:hidden">
      <p className="text-sm text-muted-foreground">템플릿으로 시작하거나, 아래에 바로 쓰기 시작하세요.</p>
      <div className="flex flex-wrap gap-2">
        {starters.map((s) => {
          const Icon = s.icon
          return (
            <button key={s.id} type="button" onClick={() => onPick(s.id)} title={s.tagline} className={chip}>
              <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
              {s.name}
            </button>
          )
        })}
        <button type="button" onClick={onAi} title="제목을 주제로 AI가 정리 노트나 문제를 만들어 줘요" className={chip}>
          <Sparkles className="size-4 text-indigo-600" aria-hidden="true" />
          AI로 채우기
        </button>
      </div>
    </section>
  )
}
