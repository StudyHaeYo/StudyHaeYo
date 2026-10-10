import { HelpCircle } from "lucide-react"

export function UnresolvedBadge({ count, long = false }: { count: number; long?: boolean }) {
  if (count <= 0) return null
  return (
    <span
      title={`미해결 헷갈린 점 ${count}개`}
      className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-50 px-1.5 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-200"
    >
      <HelpCircle className="size-3" aria-hidden="true" />
      {long ? `미해결 헷갈린 점 ${count}개` : count}
      {!long && <span className="sr-only">{`미해결 헷갈린 점 ${count}개`}</span>}
    </span>
  )
}
