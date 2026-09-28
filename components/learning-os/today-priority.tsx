import Link from "next/link"
import { Clock, Flame, Sparkles } from "lucide-react"
import { priorityStudy } from "@/lib/learning-os"

export function TodayPriority() {
  return (
    <section className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-5 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <Sparkles className="size-4 text-indigo-600" />
        <h2 className="text-sm font-medium text-indigo-700">오늘의 우선 학습</h2>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{priorityStudy.subject}</p>
          <p className="mt-0.5 text-xl font-semibold tracking-tight text-foreground text-balance">
            {priorityStudy.topic}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1 rounded-md bg-card px-2 py-1 text-muted-foreground ring-1 ring-inset ring-border">
              <Clock className="size-3" />
              마지막 학습: {priorityStudy.lastStudied}
            </span>
            <span className="rounded-md bg-amber-50 px-2 py-1 font-medium text-amber-700 ring-1 ring-inset ring-amber-200">
              상태: {priorityStudy.status}
            </span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{priorityStudy.reason}</p>
        </div>

        <Link
          href={`/record/${priorityStudy.pageId}`}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-700"
        >
          <Flame className="size-4" />
          복습하기
        </Link>
      </div>
    </section>
  )
}
