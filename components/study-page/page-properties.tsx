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
import { formatDate, formatDuration, type PageStats, type PageStatus } from "@/lib/study-pages"

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
}

export function PageProperties({ subjectName, stats, recordCount, tags, onChangeTags }: PagePropertiesProps) {
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
          <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${statusStyles[stats.status]}`}>
            {stats.status}
          </span>
        </Row>
        <Row icon={Gauge} label="이해도">
          {stats.understanding === null ? (
            empty
          ) : (
            <span className="inline-flex items-center gap-2">
              <span className="flex gap-0.5" aria-hidden="true">
                {[1, 2, 3, 4, 5].map((n) => (
                  <span
                    key={n}
                    className={`h-1.5 w-3 rounded-full ${n <= (stats.understanding ?? 0) ? "bg-indigo-600" : "bg-border"}`}
                  />
                ))}
              </span>
              {stats.understanding} / 5
            </span>
          )}
        </Row>
        <Row icon={Clock} label="학습 시간">
          {stats.totalDurationMinutes > 0 ? formatDuration(stats.totalDurationMinutes) : empty}
        </Row>
        <Row icon={CalendarCheck} label="마지막 학습">
          {stats.lastStudiedAt ? formatDate(stats.lastStudiedAt) : empty}
        </Row>
        <Row icon={CalendarClock} label="다음 복습">
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
          ? `학습 기록 ${recordCount}개를 바탕으로 계산된 현재 상태예요`
          : "학습 기록을 추가하면 이해도와 복습 일정이 채워져요"}
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
