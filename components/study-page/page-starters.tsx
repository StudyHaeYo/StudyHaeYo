"use client"

import { Sparkles } from "lucide-react"
import { noteKinds } from "@/lib/templates"

// Shown on a note whose body is still empty (D-26, D-30): pick what the note is for, or just start typing — the
// list goes away as soon as the body has anything in it, and the note stays a 빈 노트. A quiet list, one line per
// kind (2026-11-13: the cards with drawings, a heading, a caption and two lines under them read as clutter on an
// empty page). AI isn't a kind — it fills the note from the title — so it is the last row, set apart.
// A note that already has a kind (picked earlier, then emptied) stays that kind when typed into.
// Before the props column exists no kind can be saved (D-27), so only the AI row is offered.
export function PageStarters({
  kindsReady,
  hasKind,
  onPick,
  onAi,
}: {
  kindsReady: boolean
  hasKind: boolean
  onPick: (starterId: string) => void
  onAi: () => void
}) {
  const kinds = kindsReady ? noteKinds.filter((k) => k.kind !== null) : []
  const row =
    "group flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-action-500"
  const icon = "flex size-7 shrink-0 items-center justify-center rounded-md border border-border bg-background text-muted-foreground group-hover:text-foreground"
  return (
    <section aria-labelledby="starters-heading" className="-mx-2 mt-5 print:hidden">
      <p id="starters-heading" className="px-2 pb-1 text-sm text-muted-foreground">
        {kinds.length === 0 ? "비어 있는 노트예요" : hasKind ? "고르지 않고 바로 써도 돼요. 다른 종류로 시작하려면" : "그냥 쓰면 빈 노트가 돼요. 종류를 고르면 맞는 칸이 생겨요"}
      </p>
      <ul>
        {kinds.map((k) => (
          <li key={k.starterId}>
            <button type="button" onClick={() => onPick(k.starterId)} className={row}>
              <span className={icon}>
                <k.icon className="size-4" aria-hidden="true" />
              </span>
              <span className="w-20 shrink-0 text-sm font-medium text-foreground">{k.name}</span>
              <span className="min-w-0 text-pretty text-sm text-muted-foreground sm:truncate">{k.does}</span>
            </button>
          </li>
        ))}
        <li className={kinds.length > 0 ? "mt-1 border-t border-border pt-1" : ""}>
          <button type="button" onClick={onAi} title="제목을 주제로 AI가 정리 노트나 문제를 만들어 줘요" className={row}>
            <span className={`${icon} text-action-700`}>
              <Sparkles className="size-4" aria-hidden="true" />
            </span>
            <span className="w-20 shrink-0 text-sm font-medium text-action-700">AI로 채우기</span>
            <span className="min-w-0 text-pretty text-sm text-muted-foreground sm:truncate">제목을 주제로 정리 노트를 만들어요</span>
          </button>
        </li>
      </ul>
    </section>
  )
}
