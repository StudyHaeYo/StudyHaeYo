"use client"

import { useState } from "react"
import Link from "next/link"
import { CalendarRange, ChevronDown, Plus } from "lucide-react"
import { openQuickRecord } from "@/components/record/quick-record-dialog"
import { RecordRow } from "@/components/record/record-row"
import { TagEditor } from "@/components/study-page/page-properties"
import { addDays, daysBetween, formatDate, formatDuration, sortRecordsNewestFirst, type PageStats, type StudyPage } from "@/lib/study-pages"
import { activePlans, type RecordEntry } from "@/lib/study-stats"
import { noteIcon } from "@/lib/templates"
import { nodePath, updatePage, useWorkspace } from "@/lib/workspace"
import { usePlans } from "@/lib/plans"

// The end of every note (D-30): its study in one line with one [기록 남기기], the records folded below, where the
// note is used (시험 범위 · 진행 중인 계획) and its tags. What used to sit in the 속성 window lives here.
export function PageRecords({
  page,
  stats,
  today,
  subject,
}: {
  page: StudyPage
  stats: PageStats
  today: string | null
  subject: { id: string; name: string } | null
}) {
  const workspace = useWorkspace()
  const plans = usePlans()
  const [open, setOpen] = useState(false)
  const records = sortRecordsNewestFirst(page.studyRecords)
  const oldestFirst = [...records].reverse().slice(-6)
  const overdue = stats.nextReviewAt && today ? daysBetween(stats.nextReviewAt, today) : 0
  const add = () => openQuickRecord({ pageId: page.id })
  const when = (date: string) =>
    today && date === today ? "오늘" : today && date === addDays(today, -1) ? "어제" : formatDate(date)

  // Where this note is used: exams that have it in scope, and plans running today that its study counts toward.
  const exams = workspace.pages.filter((p) => p.id !== page.id && (p.props?.scope ?? []).includes(page.id))
  const ancestorIds = new Set(nodePath(workspace, page.parentId).map((n) => n.id))
  const plansHere = today
    ? activePlans(workspace, plans, today).filter(({ plan }) => {
        const t = plan.target
        if (t.scope === "subject") return ancestorIds.has(t.subjectId)
        if (t.scope === "page") return t.pageId === page.id || ancestorIds.has(t.pageId)
        return false
      })
    : []

  return (
    <section aria-labelledby="page-records-heading" id="page-records" className="flex scroll-mt-24 flex-col border-t border-border">
      <div className="flex items-center justify-between gap-3 pb-1.5 pt-4">
        <h2 id="page-records-heading" className="text-base font-bold tracking-tight text-foreground">
          학습 기록
        </h2>
        <button
          type="button"
          onClick={add}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-semibold text-foreground transition-colors hover:border-action-300 hover:text-action-700"
        >
          <Plus className="size-4" aria-hidden="true" />
          기록 남기기
        </button>
      </div>

      {records.length === 0 ? (
        <p className="pb-4 text-sm text-muted-foreground">공부를 마쳤으면 기록을 남겨 보세요. 이해도에 따라 다음 복습일이 잡혀요.</p>
      ) : (
        <>
          <p className="flex flex-wrap items-center gap-x-5 gap-y-1 py-1 text-sm tabular-nums text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span className="flex h-4 items-end gap-0.5" aria-hidden="true">
                {oldestFirst.map((r, i) => (
                  <span
                    key={r.id}
                    className={`w-1.5 rounded-sm ${i === oldestFirst.length - 1 ? "bg-action-600" : "bg-action-200"}`}
                    style={{ height: `${4 + r.understanding * 2.4}px` }}
                  />
                ))}
              </span>
              이해도 <b className="font-semibold text-foreground">{oldestFirst.map((r) => r.understanding).join(" → ")}</b>
            </span>
            <span>
              총 <b className="font-semibold text-foreground">{formatDuration(stats.totalDurationMinutes)}</b>
            </span>
            {stats.nextReviewAt && (
              <span>
                다음 복습{" "}
                <b className={`font-semibold ${stats.status === "복습 필요" ? "text-attention-700" : "text-foreground"}`}>
                  {formatDate(stats.nextReviewAt)}
                  {overdue > 0 ? `, ${overdue}일 지남` : stats.status === "복습 필요" ? ", 오늘" : ""}
                </b>
              </span>
            )}
          </p>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="page-records-list"
            className="inline-flex items-center gap-1.5 self-start rounded-md py-1.5 text-sm font-semibold text-action-700 hover:underline"
          >
            <ChevronDown className={`size-4 transition-transform ${open ? "" : "-rotate-90"}`} aria-hidden="true" />
            {open ? "기록 접기" : `기록 ${records.length}개 보기`}
          </button>
          {open && (
            <ul id="page-records-list" className="flex flex-col divide-y divide-border pb-2">
              {records.map((record) => {
                const entry: RecordEntry = {
                  record,
                  pageId: page.id,
                  pageTitle: page.title || "제목 없음",
                  subject: subject?.name ?? "",
                  subjectId: subject?.id ?? null,
                }
                return (
                  <li key={record.id}>
                    <RecordRow entry={entry} showWhere={false} when={when(record.date)} />
                  </li>
                )
              })}
            </ul>
          )}
        </>
      )}

      {(exams.length > 0 || plansHere.length > 0) && (
        <div className="flex flex-wrap items-center gap-2 border-t border-border py-3 text-sm">
          <span className="w-20 shrink-0 text-muted-foreground">들어간 곳</span>
          {exams.map((exam) => {
            const Icon = noteIcon(exam)
            return (
              <Link
                key={exam.id}
                href={`/record/${exam.id}`}
                className="inline-flex h-7 max-w-full items-center gap-1.5 rounded-md bg-muted px-2.5 font-medium text-foreground transition-colors hover:bg-accent"
              >
                <Icon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="truncate">{exam.title || "제목 없음"} 범위</span>
              </Link>
            )
          })}
          {plansHere.slice(0, 2).map(({ plan }) => (
            <Link
              key={plan.id}
              href="/plan"
              className="inline-flex h-7 max-w-full items-center gap-1.5 rounded-md bg-muted px-2.5 font-medium text-foreground transition-colors hover:bg-accent"
            >
              <CalendarRange className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span className="truncate">{plan.title} 계획</span>
            </Link>
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2 border-t border-border py-3 text-sm">
        <span className="w-20 shrink-0 text-muted-foreground">태그</span>
        <TagEditor tags={page.tags} onChange={(tags) => updatePage(page.id, (p) => ({ ...p, tags }))} />
      </div>
    </section>
  )
}
