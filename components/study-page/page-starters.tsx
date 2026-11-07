"use client"

import { Sparkles } from "lucide-react"
import { noteKinds } from "@/lib/templates"

// Shown on a note whose body is still empty (D-26, D-30): pick what the note is for, or just start typing — the
// row goes away as soon as the body has anything in it, and the note stays a 빈 노트. Each kind shows a small
// drawing of what makes it different, so the choice is visible rather than a list of names.
// AI isn't a kind — it fills the note from the title — so it sits apart at the end.
// A note that already has a kind (picked earlier, then emptied) stays that kind when typed into.
// Before the props column exists no kind can be saved (D-27), so only the AI button is offered.
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
  const kinds = noteKinds.filter((k) => k.kind !== null)
  const ai = (
    <button
      type="button"
      onClick={onAi}
      title="제목을 주제로 AI가 정리 노트나 문제를 만들어 줘요"
      className="inline-flex items-center gap-1.5 rounded-md text-sm font-semibold text-action-700 hover:underline"
    >
      <Sparkles className="size-4" aria-hidden="true" />
      AI로 채우기
    </button>
  )
  if (!kindsReady) return <div className="mt-6 print:hidden">{ai}</div>
  return (
    <section aria-labelledby="starters-heading" className="mt-6 flex flex-col gap-3 print:hidden">
      <p className="text-sm text-muted-foreground">
        <b id="starters-heading" className="mr-2 font-semibold text-foreground">
          무엇을 정리하나요?
        </b>
        고르면 그 노트에 맞는 칸이 생겨요
      </p>
      <div className="grid grid-cols-3 gap-2.5">
        {kinds.map((k) => (
          <button
            key={k.starterId}
            type="button"
            onClick={() => onPick(k.starterId)}
            className="flex flex-col rounded-xl border border-border bg-card p-2.5 text-left transition-[border-color,transform] duration-150 hover:border-action-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action-500 active:scale-[0.98] motion-reduce:active:scale-100"
          >
            <Mini kind={k.starterId} />
            <span className="mt-2.5 text-sm font-semibold text-foreground">{k.name}</span>
            <span className="mt-0.5 text-xs leading-snug text-muted-foreground">{k.does}</span>
          </button>
        ))}
      </div>
      <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
        <span>{hasKind ? "고르지 않고 바로 써도 돼요" : "그냥 쓰기 시작하면 빈 노트가 돼요"}</span>
        {ai}
      </p>
    </section>
  )
}

// Small drawings of each kind's main block. Decorative: the name and description say the same in words.
function Mini({ kind }: { kind: string }) {
  const line = "absolute h-[3px] rounded-full bg-muted-foreground/25"
  return (
    <span aria-hidden="true" className="relative block h-16 overflow-hidden rounded-lg bg-muted">
      {kind === "lecture" && (
        <>
          {/* 코넬 노트 (D-35): questions on the left, notes on the right, a summary under a line. Sizes in % so the
              drawing shrinks with the card on a phone instead of being cut off. */}
          <span className="absolute left-[10%] top-3 h-[3px] w-[18%] rounded-full bg-foreground/60" />
          <span className="absolute left-[10%] top-7 h-[3px] w-[14%] rounded-full bg-foreground/60" />
          <span className="absolute bottom-5 left-[33%] top-2.5 w-0.5 rounded-full bg-action-300" />
          <span className={`${line} left-[38%] top-3 w-[44%]`} />
          <span className={`${line} left-[38%] top-5 w-[36%]`} />
          <span className={`${line} left-[38%] top-7 w-[40%]`} />
          <span className="absolute inset-x-[10%] bottom-3.5 h-px bg-border" />
          <span className={`${line} bottom-1.5 left-[10%] w-[52%]`} />
        </>
      )}
      {kind === "wrong-answers" && (
        <>
          <span className="absolute left-3 top-2.5 text-sm font-bold text-foreground">1</span>
          <svg className="absolute left-1 top-1 size-6 fill-none stroke-muted-foreground" viewBox="0 0 52 52" strokeWidth="3.5" strokeLinecap="round">
            <path d="M27 5C40 5 47 14 47 26C47 38 38 47 26 47C13 47 5 38 5 26C5 15 13 6 24 6.5" />
          </svg>
          <span className={`${line} left-9 top-4 w-14 max-w-[calc(100%-3rem)]`} />
          <span className="absolute left-3 top-9 text-sm font-bold text-foreground">2</span>
          <svg className="absolute left-1.5 top-8 size-5 fill-none stroke-muted-foreground" viewBox="0 0 52 52" strokeWidth="4" strokeLinecap="round">
            <path d="M10 44L44 8" />
          </svg>
          <span className={`${line} left-9 top-[2.65rem] w-11 max-w-[calc(100%-3rem)]`} />
        </>
      )}
      {kind === "exam" && (
        <span className="absolute left-1/2 top-2.5 w-12 -translate-x-1/2 overflow-hidden rounded-sm border border-border bg-card text-center">
          <span className="block h-2 bg-action-600" />
          <span className="block text-lg font-extrabold leading-7 text-foreground">12</span>
        </span>
      )}
    </span>
  )
}
