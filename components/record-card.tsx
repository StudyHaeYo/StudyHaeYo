"use client"

import { CalendarClock, Clock, Gauge, Tag } from "lucide-react"
import type { StudyRecord, StudyType } from "@/lib/types"
import { UnresolvedBadge } from "@/components/study-page/unresolved-badge"

const typeStyles: Record<StudyType, string> = {
  강의: "bg-indigo-50 text-indigo-700 ring-indigo-200",
  문제풀이: "bg-amber-50 text-amber-700 ring-amber-200",
  복습: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  정리: "bg-sky-50 text-sky-700 ring-sky-200",
}

interface RecordCardProps {
  record: StudyRecord
  unresolvedConfusions?: number
  onClick?: (id: string) => void
}

export function RecordCard({ record, unresolvedConfusions = 0, onClick }: RecordCardProps) {
  return (
    <button
      onClick={() => onClick?.(record.id)}
      className="group flex w-full flex-col gap-3 rounded-xl border border-border bg-card p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-base font-medium text-card-foreground">
          {record.title}
        </h3>
        <span
          className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${typeStyles[record.type]}`}
        >
          {record.type}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-1 font-medium text-foreground">
          <Tag className="size-3" />
          {record.category}
        </span>
        <span className="inline-flex items-center gap-1">
          <Clock className="size-3" />
          {record.createdAt}
        </span>
        {record.understanding !== undefined && (
          <span className="inline-flex items-center gap-1">
            <Gauge className="size-3" />
            이해도 {record.understanding}/5
          </span>
        )}
        {record.reviewDate && (
          <span className="inline-flex items-center gap-1 font-medium text-indigo-600">
            <CalendarClock className="size-3" />
            복습 예정 {record.reviewDate}
          </span>
        )}
        <UnresolvedBadge count={unresolvedConfusions} long />
      </div>
    </button>
  )
}
