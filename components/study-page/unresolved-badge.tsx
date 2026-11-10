import { HelpCircle } from "lucide-react"

export function UnresolvedBadge({ count, long = false, quiet = false }: { count: number; long?: boolean; quiet?: boolean }) {
  if (count <= 0) return null
  // PROTOTYPE (시안): in lists the count is plain grey text, so one row carries one colour signal at most.
  if (quiet)
    return (
      <span title={`미해결 헷갈린 점 ${count}개`} className="inline-flex shrink-0 items-center gap-0.5 text-xs tabular-nums text-muted-foreground">
        <HelpCircle className="size-3" aria-hidden="true" />
        {count}
        <span className="sr-only">{`미해결 헷갈린 점 ${count}개`}</span>
      </span>
    )
  return (
    <span
      title={`미해결 헷갈린 점 ${count}개`}
      className="inline-flex shrink-0 items-center gap-1 rounded-full bg-attention-50 px-1.5 py-0.5 text-xs font-medium text-attention-700 ring-1 ring-inset ring-attention-200"
    >
      <HelpCircle className="size-3" aria-hidden="true" />
      {long ? `미해결 헷갈린 점 ${count}개` : count}
      {!long && <span className="sr-only">{`미해결 헷갈린 점 ${count}개`}</span>}
    </span>
  )
}
