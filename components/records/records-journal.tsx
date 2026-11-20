"use client"

import { useState } from "react"
import Link from "next/link"
import { ChevronRight, Plus, Search, Timer, X } from "lucide-react"
import { openQuickRecord } from "@/components/record/quick-record-dialog"
import { RecordRow } from "@/components/record/record-row"
import { addDays, formatDate, formatDuration } from "@/lib/study-pages"
import { allRecordEntries, recordText, sortEntriesNewestFirst, weekStart, type RecordEntry } from "@/lib/study-stats"
import { recordCreatedAt } from "@/lib/study-session"
import { NO_SUBJECT, useSubjectRecordsReady, useWorkspace } from "@/lib/workspace"
import { useTodayISO } from "@/hooks/use-today"
import { PageHeader, primaryButton } from "@/components/page-shell"
import { button } from "@/components/ui-styles"

const PAGE_DAYS = 14
const NONE = "none"

// 학습 기록 (D-28): every record in one log — on notes, on subjects, and with neither (과목 없음, D-24) — grouped by
// day with the day's total. Records without a note are normal here (수업, 문제집, 인강); only ones that look worth
// reviewing get a quiet [복습 노트 만들기]. `noteIds`: only those notes' records (opened from a note's [기록] or a
// 시험 정리's [범위 기록], D-36); fixing and removing a note's records happens here.
export function RecordsJournal({ noteIds = [] }: { noteIds?: string[] }) {
  const workspace = useWorkspace()
  const today = useTodayISO()
  const ready = useSubjectRecordsReady()
  const [filter, setFilter] = useState<string>("all")
  const [query, setQuery] = useState("")
  const [days, setDays] = useState(PAGE_DAYS)

  const notes = new Set(noteIds)
  const byNote = notes.size > 0
  const entries = allRecordEntries(workspace).filter((e) => !byNote || (e.pageId !== null && notes.has(e.pageId)))
  const onlyNote = noteIds.length === 1 ? workspace.pages.find((p) => p.id === noteIds[0]) : undefined
  const subjects = [...new Map(entries.filter((e) => e.subjectId).map((e) => [e.subjectId!, e.subject])).entries()]
    .map(([id, name]) => ({ id, name, count: entries.filter((e) => e.subjectId === id).length }))
    .sort((a, b) => b.count - a.count)
  const noneCount = entries.filter((e) => e.subjectId === null).length
  const q = query.trim().toLowerCase()
  const shown = sortEntriesNewestFirst(entries)
    .filter((e) => byNote || filter === "all" || (filter === NONE ? e.subjectId === null : e.subjectId === filter))
    .filter((e) => !q || [recordText(e), e.pageTitle ?? "", e.subject, e.record.difficulties].join(" ").toLowerCase().includes(q))
    .sort((a, b) => b.record.date.localeCompare(a.record.date))

  const byDay = new Map<string, RecordEntry[]>()
  for (const e of shown) byDay.set(e.record.date, [...(byDay.get(e.record.date) ?? []), e])
  const dayList = [...byDay.entries()]

  const week = today ? entries.filter((e) => e.record.date >= weekStart(today) && e.record.date <= today) : []
  const weekMinutes = week.reduce((sum, e) => sum + e.record.durationMinutes, 0)

  const chip = (active: boolean) =>
    `touch-hit inline-flex h-8 shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-3 text-sm transition-colors ${
      active ? "border-foreground bg-foreground font-semibold text-background" : "border-border bg-background text-foreground hover:bg-accent"
    }`

  return (
    <div className="flex flex-col">
      <PageHeader
        title="학습 기록"
        // Only a fact the list does not show at a glance; what the page is for is said by its empty state.
        description={
          today && week.length > 0 ? (
            <>
              이번 주 <b className="font-semibold text-foreground">{formatDuration(weekMinutes)}</b>
            </>
          ) : undefined
        }
        actions={
          <button type="button" onClick={() => openQuickRecord()} className={primaryButton}>
            <Plus aria-hidden="true" />
            기록 남기기
          </button>
        }
      />

      <div className="flex items-center gap-3">
        {byNote ? (
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1.5">
            <span className={`${chip(true)} max-w-full pr-1.5`}>
              <span className="truncate">{onlyNote ? `${onlyNote.title || "제목 없음"}의 기록` : `노트 ${noteIds.length}개의 기록`}</span>
              <Link
                href="/records"
                aria-label="거르기 풀고 모든 기록 보기"
                className="ml-0.5 flex size-5 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-background/20"
              >
                <X className="size-3.5" aria-hidden="true" />
              </Link>
            </span>
            {onlyNote && (
              <Link href={`/record/${onlyNote.id}`} className="text-sm font-medium text-action-700 hover:underline">
                노트로 돌아가기
              </Link>
            )}
          </div>
        ) : (
        <div role="group" aria-label="과목으로 거르기" className="-mx-1 flex min-w-0 flex-1 gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
          <button type="button" aria-pressed={filter === "all"} onClick={() => setFilter("all")} className={chip(filter === "all")}>
            전체
          </button>
          {subjects.map((s) => (
            <button key={s.id} type="button" aria-pressed={filter === s.id} onClick={() => setFilter(s.id)} className={chip(filter === s.id)}>
              {s.name}
            </button>
          ))}
          {(noneCount > 0 || ready) && (
            <button type="button" aria-pressed={filter === NONE} onClick={() => setFilter(NONE)} className={chip(filter === NONE)}>
              {NO_SUBJECT}
              <span className="text-xs opacity-60">{noneCount}</span>
            </button>
          )}
        </div>
        )}
        <label className="hidden h-8 w-52 shrink-0 items-center gap-2 rounded-lg border border-border px-2.5 text-sm text-muted-foreground focus-within:border-action-400 sm:flex">
          <Search className="size-4 shrink-0" aria-hidden="true" />
          <span className="sr-only">기록 검색</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="기록 검색…"
            autoComplete="off"
            className="min-w-0 flex-1 bg-transparent text-foreground outline-none placeholder:text-muted-foreground/80"
          />
        </label>
      </div>

      {!today ? (
        <div className="mt-6 flex flex-col gap-3" aria-hidden="true">
          <div className="h-16 animate-pulse rounded-xl bg-muted" />
          <div className="h-16 animate-pulse rounded-xl bg-muted" />
        </div>
      ) : dayList.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-border px-6 py-10 text-center">
          <p className="text-sm font-medium text-foreground">
            {byNote && !q ? "이 노트의 기록 없음" : q || filter !== "all" ? "맞는 기록 없음" : "아직 학습 기록 없음"}
          </p>
        </div>
      ) : (
        <>
          {dayList.slice(0, days).map(([date, list]) => (
            <section key={date} aria-label={dayLabel(date, today)} className="mt-7">
              <div className="flex items-baseline justify-between border-b border-border pb-2">
                <h2 className="text-sm font-semibold text-foreground">
                  {dayLabel(date, today)}
                  <span className="ml-1.5 font-normal text-muted-foreground">{weekdayLabel(date, today)}</span>
                </h2>
                <span className="text-sm font-semibold tabular-nums text-foreground">
                  {formatDuration(list.reduce((sum, e) => sum + e.record.durationMinutes, 0))}
                </span>
              </div>
              <ul className="flex flex-col divide-y divide-border">
                {(byNote ? list.map((e) => [e]) : sessionGroups(list)).map((group) =>
                  group.length === 1 ? (
                    <li key={group[0].record.id}>
                      <RecordRow entry={group[0]} when={timeOfDay(group[0])} />
                    </li>
                  ) : (
                    <li key={group[0].record.id}>
                      <SessionGroup entries={group} when={timeOfDay(group[0])} />
                    </li>
                  ),
                )}
              </ul>
            </section>
          ))}
          {dayList.length > days && (
            <button
              type="button"
              onClick={() => setDays((d) => d + PAGE_DAYS)}
              className={button("ghost", "md", "mx-auto mt-6 px-4")}
            >
              이전 기록 더 보기
            </button>
          )}
        </>
      )}
    </div>
  )
}

// Records saved together from one timer summary share their createdAt to the millisecond (the session's end, kept as
// is in the DB): shown as one session (2026-11-16, "학습 기록에선 통합된 기록으로"). Each record stays its own row
// underneath, since 이해도 and the next review are per note. In list order, the group where its first record is.
function sessionGroups(list: RecordEntry[]): RecordEntry[][] {
  const groups: RecordEntry[][] = []
  const byTime = new Map<number, RecordEntry[]>()
  for (const entry of list) {
    const at = typeof entry.record.createdAt === "number" ? entry.record.createdAt : null
    const group = at !== null ? byTime.get(at) : undefined
    if (group) {
      group.push(entry)
      continue
    }
    const fresh = [entry]
    if (at !== null) byTime.set(at, fresh)
    groups.push(fresh)
  }
  return groups
}

function SessionGroup({ entries: saved, when }: { entries: RecordEntry[]; when?: string }) {
  const [open, setOpen] = useState(false)
  // In the order they were studied (each record starts at its note's first moment in the session).
  const entries = [...saved].sort((a, b) => (a.record.startedAt ?? 0) - (b.record.startedAt ?? 0))
  const id = `session-${entries[0].record.id}`
  const minutes = entries.reduce((sum, e) => sum + e.record.durationMinutes, 0)
  const notes = entries.filter((e) => e.pageId !== null)
  const outside = entries.length - notes.length
  const names = notes.map((e) => e.pageTitle ?? "제목 없음")
  const summary = [names.slice(0, 3).join(" · "), names.length > 3 ? `외 ${names.length - 3}개` : "", outside > 0 ? "앱 밖" : ""]
    .filter(Boolean)
    .join(names.length > 0 && outside > 0 ? " + " : " ")
  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((v) => !v)}
        className="grid w-full grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 rounded-md py-3.5 pr-9 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action-500 sm:pr-10"
      >
        <span className="flex min-w-0 items-start gap-1.5 text-base leading-relaxed text-foreground">
          <ChevronRight
            className={`mt-1 size-4 shrink-0 text-muted-foreground transition-transform duration-150 ${open ? "rotate-90" : ""}`}
            aria-hidden="true"
          />
          <span className="min-w-0">{summary}</span>
        </span>
        <span className="text-sm font-medium tabular-nums text-foreground">{formatDuration(minutes)}</span>
        <span className="col-span-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 pl-[22px] text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Timer className="size-3.5" aria-hidden="true" />
            {`타이머 세션 · 기록 ${entries.length}개`}
          </span>
          {when && <span className="tabular-nums">{when}</span>}
        </span>
      </button>
      {open && (
        <ul id={id} className="mb-3 ml-[7px] flex flex-col divide-y divide-border border-l border-border pl-4">
          {entries.map((entry) => (
            <li key={entry.record.id}>
              <RecordRow entry={entry} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function dayLabel(date: string, today: string) {
  if (date === today) return "오늘"
  if (date === addDays(today, -1)) return "어제"
  return formatDate(date)
}

function weekdayLabel(date: string, today: string) {
  const [y, m, d] = date.split("-").map(Number)
  const weekday = new Intl.DateTimeFormat("ko-KR", { weekday: "long" }).format(new Date(y, m - 1, d))
  return date === today || date === addDays(today, -1) ? `${formatDate(date)} ${weekday}` : weekday
}

function timeOfDay(entry: RecordEntry) {
  const at = recordCreatedAt(entry.record)
  if (at === null) return undefined
  const created = new Date(at)
  const [y, m, d] = entry.record.date.split("-").map(Number)
  // A record dated another day than it was written (남긴 날 ≠ 공부한 날) has no meaningful time of day.
  if (created.getFullYear() !== y || created.getMonth() !== m - 1 || created.getDate() !== d) return undefined
  return new Intl.DateTimeFormat("ko-KR", { hour: "numeric", minute: "2-digit" }).format(created)
}
