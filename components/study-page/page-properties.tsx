"use client"

import { useState, type ReactNode } from "react"
import {
  BookOpen,
  CalendarCheck,
  CalendarClock,
  CircleDot,
  Clock,
  Gauge,
  Hash,
  X,
  type LucideIcon,
} from "lucide-react"
import { formatDate, formatDuration, pageStatuses, type PageStats, type PageStatus } from "@/lib/study-pages"

const statusStyles: Record<PageStatus, string> = {
  "시작 전": "bg-muted text-muted-foreground",
  "학습 중": "bg-indigo-50 text-indigo-700",
  "복습 필요": "bg-amber-50 text-amber-700",
  완료: "bg-indigo-600 text-white",
}

interface PagePropertiesProps {
  subjectName: string
  stats: PageStats
  recordCount: number
  tags: string[]
  onChangeTags: (tags: string[]) => void
  onChangeStatus: (status: PageStatus | null) => void
  onChangeUnderstanding: (understanding: number | null) => void
}

export function PageProperties({
  subjectName,
  stats,
  recordCount,
  tags,
  onChangeTags,
  onChangeStatus,
  onChangeUnderstanding,
}: PagePropertiesProps) {
  const [draft, setDraft] = useState("")
  const empty = <span className="text-muted-foreground/70">비어 있음</span>

  const addTag = () => {
    const next = draft.trim().replace(/^#/, "")
    if (next && !tags.includes(next)) onChangeTags([...tags, next])
    setDraft("")
  }

  return (
    <section aria-label="페이지 속성" className="flex flex-col gap-0.5">
      <dl className="flex flex-col">
        <Row icon={BookOpen} label="과목">
          {subjectName}
        </Row>
        <Row icon={CircleDot} label="상태">
          <span className="inline-flex items-center gap-2">
            <span className="relative inline-flex">
              <span
                className={`pointer-events-none rounded px-1.5 py-0.5 text-xs font-medium ${statusStyles[stats.status]}`}
              >
                {stats.status}
              </span>
              <select
                aria-label="학습 상태 변경"
                value={stats.statusIsManual ? stats.status : ""}
                onChange={(e) => onChangeStatus((e.target.value || null) as PageStatus | null)}
                className="absolute inset-0 cursor-pointer opacity-0"
              >
                <option value="">자동 (학습 기록 기준)</option>
                {pageStatuses.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </span>
            {!stats.statusIsManual && <span className="text-xs text-muted-foreground/70">자동</span>}
          </span>
        </Row>
        <Row icon={Gauge} label="이해도">
          <span className="inline-flex items-center gap-2">
            <span role="group" aria-label="이해도 선택" className="flex">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => onChangeUnderstanding(n)}
                  aria-label={`이해도 ${n}`}
                  aria-pressed={stats.understanding === n}
                  className="group/bar flex h-6 items-center px-px"
                >
                  <span
                    className={`h-1.5 w-3 rounded-full transition-colors ${
                      n <= (stats.understanding ?? 0)
                        ? "bg-indigo-600 group-hover/bar:bg-indigo-500"
                        : "bg-border group-hover/bar:bg-indigo-200"
                    }`}
                  />
                </button>
              ))}
            </span>
            {stats.understanding === null ? empty : `${stats.understanding} / 5`}
            {stats.understandingIsManual && (
              <button
                type="button"
                onClick={() => onChangeUnderstanding(null)}
                className="rounded px-1 text-xs text-muted-foreground/70 transition-colors hover:bg-muted hover:text-foreground"
              >
                기록 기준으로
              </button>
            )}
          </span>
        </Row>
        <Row icon={Clock} label="학습 시간">
          {stats.totalDurationMinutes > 0 ? formatDuration(stats.totalDurationMinutes) : empty}
        </Row>
        <Row icon={CalendarCheck} label="마지막 학습">
          {stats.lastStudiedAt ? formatDate(stats.lastStudiedAt) : empty}
        </Row>
        <Row icon={CalendarClock} label="다음 학습">
          {stats.nextReviewAt ? (
            <span className={stats.status === "복습 필요" ? "font-medium text-amber-700" : undefined}>
              {formatDate(stats.nextReviewAt)}
            </span>
          ) : (
            empty
          )}
        </Row>
        <Row icon={Hash} label="태그">
          <span className="flex flex-wrap items-center gap-1">
            {tags.map((tag) => (
              <span
                key={tag}
                className="group inline-flex items-center gap-0.5 rounded bg-muted px-1.5 py-0.5 text-xs text-foreground"
              >
                #{tag}
                <button
                  type="button"
                  onClick={() => onChangeTags(tags.filter((t) => t !== tag))}
                  aria-label={`${tag} 태그 삭제`}
                  className="rounded text-muted-foreground opacity-0 transition-opacity hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
                >
                  <X className="size-3" />
                </button>
              </span>
            ))}
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.nativeEvent.isComposing || e.keyCode === 229) return
                if (e.key === "Enter") {
                  e.preventDefault()
                  addTag()
                }
              }}
              onBlur={addTag}
              aria-label="태그 추가"
              placeholder={tags.length === 0 ? "태그 추가" : "+"}
              className="w-20 rounded bg-transparent px-1 py-0.5 text-xs outline-none placeholder:text-muted-foreground/70 focus:bg-muted"
            />
          </span>
        </Row>
      </dl>
      <p className="pl-2 pt-1 text-xs text-muted-foreground/80">
        {recordCount > 0
          ? `상태와 이해도는 직접 바꿀 수 있고, 새 학습 기록을 추가하면 기록 기준으로 다시 맞춰져요 (기록 ${recordCount}개)`
          : "상태와 이해도를 직접 고르거나, 학습 기록을 추가해 복습 일정까지 채워 보세요"}
      </p>
    </section>
  )
}

function Row({ icon: Icon, label, children }: { icon: LucideIcon; label: string; children: ReactNode }) {
  return (
    <div className="flex min-h-8 items-center gap-2 rounded-md px-2 py-1 text-sm transition-colors hover:bg-muted/60">
      <dt className="flex w-28 shrink-0 items-center gap-2 text-muted-foreground">
        <Icon className="size-4" aria-hidden="true" />
        {label}
      </dt>
      <dd className="min-w-0 flex-1 text-foreground">{children}</dd>
    </div>
  )
}
