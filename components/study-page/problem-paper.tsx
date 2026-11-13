"use client"

import { formatDate, wrongReasons, type TextBlock, type WrongReason } from "@/lib/study-pages"

// 오답 노트 = 채점된 시험지 (D-35). The editor draws these around an ordinary toggle (the problem as its title, the
// answer and 풀이 as its body); nothing here is required, a problem works with all of it left empty.

// The problem number with a grading mark over it, like a marked exam paper: a circle when it was right, a slash
// otherwise (a problem without a result counts as wrong, D-27). No mark until the problem has a question.
export function ProblemNumber({ n, result, marked }: { n: number; result: TextBlock["result"]; marked: boolean }) {
  return (
    <span aria-hidden="true" className="relative mt-0.5 flex h-7 w-9 shrink-0 select-none items-start pl-1 text-xl font-bold leading-7 tabular-nums text-foreground">
      {n}
      {marked &&
        (result === "right" ? (
          <svg viewBox="0 0 52 52" className="absolute -left-2 -top-1.5 size-9 fill-none stroke-success-600" strokeWidth="3" strokeLinecap="round">
            <path d="M27 5C40 5 47 14 47 26C47 38 38 47 26 47C13 47 5 38 5 26C5 15 13 6 24 6.5" />
          </svg>
        ) : (
          <svg viewBox="0 0 52 52" className="absolute -left-1.5 -top-1 size-9 fill-none stroke-danger-600" strokeWidth="2.5" strokeLinecap="round">
            <path d="M10 44L44 8" />
          </svg>
        ))}
    </span>
  )
}

// 내 답: one line. In review it stays in sight (read only) while the answer under it is covered.
export function MyAnswer({
  value,
  problem,
  onChange,
  readOnly = false,
}: {
  value: string | undefined
  problem: string
  onChange: (value: string) => void
  readOnly?: boolean
}) {
  if (readOnly)
    return value?.trim() ? (
      <p className="text-[15px] leading-relaxed text-foreground">
        <span className="mr-2 inline-block w-7 text-xs text-muted-foreground">내 답</span>
        {value}
      </p>
    ) : null
  return (
    <label className="flex items-baseline gap-2 text-[15px] leading-relaxed">
      <span className="w-7 shrink-0 text-xs text-muted-foreground">내 답</span>
      <input
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        onMouseDown={(e) => e.stopPropagation()}
        placeholder="내가 쓴 답…"
        autoComplete="off"
        spellCheck={false}
        aria-label={`${problem || "이 문제"} 내 답`}
        className="min-w-0 flex-1 bg-transparent text-foreground outline-none placeholder:text-muted-foreground/60"
      />
    </label>
  )
}

// 틀린 이유: small words to press, any number of them or none (D-35). Read back in the head line (reasonSummary).
export function WrongReasons({ value, onChange }: { value: WrongReason[] | undefined; onChange: (value: WrongReason[]) => void }) {
  const picked = new Set(value ?? [])
  return (
    <div role="group" aria-label="틀린 이유 (골라도 되고 안 골라도 돼요)" className="flex flex-wrap items-center gap-1">
      <span className="mr-1 text-xs text-muted-foreground">틀린 이유</span>
      {wrongReasons.map((r) => {
        const on = picked.has(r.id)
        return (
          <button
            key={r.id}
            type="button"
            aria-pressed={on}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={() => onChange(wrongReasons.map((w) => w.id).filter((id) => (id === r.id ? !on : picked.has(id))))}
            className={`rounded px-1.5 py-0.5 text-xs transition-colors ${
              on ? "bg-danger-50 font-medium text-danger-700" : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            {r.label}
          </button>
        )
      })}
    </div>
  )
}

// Under a folded problem: what it holds, so a folded paper still reads (and a solved one says it can be opened).
export function ProblemFoldedLine({ block }: { block: TextBlock }) {
  if (block.result === "right")
    return (
      <p className="text-[13px] text-muted-foreground">
        맞힘{block.triedOn ? ` · ${formatDate(block.triedOn)}` : ""} · 눌러서 다시 보기
      </p>
    )
  const reasons = wrongReasons.filter((r) => block.reasons?.includes(r.id)).map((r) => r.label)
  const parts = [block.myAnswer?.trim() ? `내 답 ${block.myAnswer.trim()}` : "", ...reasons].filter(Boolean)
  if (parts.length === 0) return null
  return <p className="truncate text-[13px] text-muted-foreground">{parts.join(" · ")}</p>
}
