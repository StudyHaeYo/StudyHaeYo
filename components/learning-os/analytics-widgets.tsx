"use client"

import Link from "next/link"
import { AlertTriangle, CalendarClock, History } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { useTodayISO } from "@/hooks/use-today"
import { formatDate } from "@/lib/study-pages"
import { recentActivity, upcomingReviews, weakAreas } from "@/lib/study-stats"
import { useWorkspace } from "@/lib/workspace"

function Panel({
  title,
  icon: Icon,
  iconClassName,
  children,
}: {
  title: string
  icon: LucideIcon
  iconClassName: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <Icon className={`size-4 ${iconClassName}`} />
        <h2 className="text-sm font-medium text-card-foreground">{title}</h2>
      </div>
      {children}
    </section>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted-foreground text-pretty">{children}</p>
}

function ListSkeleton() {
  return (
    <div className="flex flex-col gap-2" aria-hidden="true">
      <div className="h-9 animate-pulse rounded-lg bg-muted" />
      <div className="h-9 animate-pulse rounded-lg bg-muted" />
    </div>
  )
}

export function WeakAreas() {
  const items = weakAreas(useWorkspace())
  return (
    <Panel title="취약 학습 영역" icon={AlertTriangle} iconClassName="text-amber-600">
      {items.length === 0 ? (
        <Empty>이해도가 낮거나 미해결 헷갈린 점이 있는 페이지가 없어요.</Empty>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((item) => (
            <li key={item.pageId}>
              <Link
                href={`/record/${item.pageId}`}
                className="flex items-center justify-between gap-3 rounded-lg bg-muted/60 px-3 py-2.5 text-sm transition-colors hover:bg-accent"
              >
                <span className="min-w-0 truncate">
                  <span className="text-muted-foreground">{item.subject}</span>
                  <span className="px-1.5 text-muted-foreground">·</span>
                  <span className="font-medium text-card-foreground">{item.pageTitle}</span>
                </span>
                <span className="flex shrink-0 items-center gap-2 text-xs">
                  {item.unresolved > 0 && (
                    <span className="rounded-full bg-amber-50 px-2 py-0.5 font-medium text-amber-700 ring-1 ring-inset ring-amber-200">
                      {`미해결 ${item.unresolved}개`}
                    </span>
                  )}
                  <span className="text-muted-foreground">
                    {item.understanding === null ? "이해도 -" : `이해도 ${item.understanding}/5`}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}

export function UpcomingReviews() {
  const workspace = useWorkspace()
  const today = useTodayISO()
  const items = today ? upcomingReviews(workspace, today) : null
  return (
    <Panel title="복습 예정" icon={CalendarClock} iconClassName="text-indigo-600">
      {items === null ? (
        <ListSkeleton />
      ) : items.length === 0 ? (
        <Empty>예정된 복습이 없어요.</Empty>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {items.map((item) => (
            <li key={item.pageId}>
              <Link
                href={`/record/${item.pageId}`}
                className="-mx-2 flex items-center justify-between gap-3 rounded-lg px-2 py-2.5 text-sm transition-colors hover:bg-accent"
              >
                <span className="min-w-0 truncate">
                  <span className="font-medium text-card-foreground">{item.pageTitle}</span>
                  <span className="ml-2 text-xs text-muted-foreground">{item.subject}</span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  {item.relative && (
                    <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700 ring-1 ring-inset ring-indigo-200">
                      {item.relative}
                    </span>
                  )}
                  <span className="font-semibold text-indigo-600">{item.dateLabel}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}

export function RecentActivity() {
  const items = recentActivity(useWorkspace())
  return (
    <Panel title="최근 학습 활동" icon={History} iconClassName="text-indigo-600">
      {items.length === 0 ? (
        <Empty>아직 학습 기록이 없어요.</Empty>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {items.map((item) => (
            <li key={item.record.id}>
              <Link
                href={`/record/${item.pageId}`}
                className="-mx-2 flex items-center justify-between gap-3 rounded-lg px-2 py-2.5 text-sm transition-colors hover:bg-accent"
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium text-card-foreground">{item.pageTitle}</span>
                  <span className="text-xs text-muted-foreground">
                    {`${item.subject} · ${formatDate(item.record.date)}`}
                  </span>
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">{`이해도 ${item.record.understanding}/5`}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}
