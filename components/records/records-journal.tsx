"use client"

import { useState } from "react"
import { Plus, Search } from "lucide-react"
import { openQuickRecord } from "@/components/record/quick-record-dialog"
import { RecordRow } from "@/components/record/record-row"
import { addDays, formatDate, formatDuration } from "@/lib/study-pages"
import { allRecordEntries, recordText, sortEntriesNewestFirst, weekStart, type RecordEntry } from "@/lib/study-stats"
import { recordCreatedAt } from "@/lib/study-session"
import { NO_SUBJECT, useSubjectRecordsReady, useWorkspace } from "@/lib/workspace"
import { useTodayISO } from "@/hooks/use-today"

const PAGE_DAYS = 14
const NONE = "none"

// 학습 기록 (D-28): every record in one log — on notes, on subjects, and with neither (과목 없음, D-24) — grouped by
// day with the day's total. Records without a note are normal here (수업, 문제집, 인강); only ones that look worth
// reviewing get a quiet [복습 노트 만들기].
export function RecordsJournal() {
  const workspace = useWorkspace()
  const today = useTodayISO()
  const ready = useSubjectRecordsReady()
  const [filter, setFilter] = useState<string>("all")
  const [query, setQuery] = useState("")
  const [days, setDays] = useState(PAGE_DAYS)

  const entries = allRecordEntries(workspace)
  const subjects = [...new Map(entries.filter((e) => e.subjectId).map((e) => [e.subjectId!, e.subject])).entries()]
    .map(([id, name]) => ({ id, name, count: entries.filter((e) => e.subjectId === id).length }))
    .sort((a, b) => b.count - a.count)
  const noneCount = entries.filter((e) => e.subjectId === null).length
  const q = query.trim().toLowerCase()
  const shown = sortEntriesNewestFirst(entries)
    .filter((e) => filter === "all" || (filter === NONE ? e.subjectId === null : e.subjectId === filter))
    .filter((e) => !q || [recordText(e), e.pageTitle ?? "", e.subject, e.record.difficulties].join(" ").toLowerCase().includes(q))
    .sort((a, b) => b.record.date.localeCompare(a.record.date))

  const byDay = new Map<string, RecordEntry[]>()
  for (const e of shown) byDay.set(e.record.date, [...(byDay.get(e.record.date) ?? []), e])
  const dayList = [...byDay.entries()]

  const week = today ? entries.filter((e) => e.record.date >= weekStart(today) && e.record.date <= today) : []
  const weekMinutes = week.reduce((sum, e) => sum + e.record.durationMinutes, 0)
  const weekOffNote = week.filter((e) => e.pageId === null).reduce((sum, e) => sum + e.record.durationMinutes, 0)

  const chip = (active: boolean) =>
    `inline-flex h-8 shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-3 text-[13px] transition-colors ${
      active ? "border-foreground bg-foreground font-semibold text-background" : "border-border bg-background text-foreground hover:bg-accent"
    }`

  return (
    <div className="mx-auto flex max-w-3xl flex-col">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">학습 기록</h1>
          <p className="mt-1 text-sm text-muted-foreground text-pretty">
            {today && week.length > 0 ? (
              <>
                이번 주 <b className="font-semibold text-foreground">{formatDuration(weekMinutes)}</b>
                {weekOffNote > 0 && (
                  <>
                    {" "}· 노트 없이 공부한 시간 <b className="font-semibold text-foreground">{formatDuration(weekOffNote)}</b> 포함
                  </>
                )}
              </>
            ) : (
              "노트에서 한 공부도, 수업 · 문제집 · 인강처럼 앱 밖에서 한 공부도 여기에 모여요."
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={() => openQuickRecord()}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700"
        >
          <Plus className="size-4" aria-hidden="true" />
          기록 남기기
        </button>
      </header>

      <div className="mt-6 flex items-center gap-3">
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
        <label className="hidden h-8 w-52 shrink-0 items-center gap-2 rounded-lg border border-border px-2.5 text-sm text-muted-foreground focus-within:border-indigo-400 sm:flex">
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
        <div className="mt-8 rounded-2xl border border-dashed border-border px-6 py-10 text-center">
          <p className="text-sm font-medium text-foreground">{q || filter !== "all" ? "맞는 기록이 없어요" : "아직 학습 기록이 없어요"}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            공부를 마치면 [기록 남기기]로 남겨요. 노트에서 공부했다면 그 노트를 고르면 복습일이 잡혀요.
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
                {list.map((entry) => (
                  <li key={entry.record.id}>
                    <RecordRow entry={entry} when={timeOfDay(entry)} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
          {dayList.length > days && (
            <button
              type="button"
              onClick={() => setDays((d) => d + PAGE_DAYS)}
              className="mx-auto mt-6 h-9 rounded-lg px-4 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              이전 기록 더 보기
            </button>
          )}
        </>
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
