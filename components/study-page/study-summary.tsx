"use client"

import { formatDate, formatDuration, pageStatuses, type PageStats, type PageStatus } from "@/lib/study-pages"

// What the study records add up to (D-27): status, understanding, time, last and next study. Shown above the
// records because it is computed from them. Status and understanding can still be picked by hand (small controls).

const statusStyles: Record<PageStatus, string> = {
  "시작 전": "bg-muted text-muted-foreground",
  "학습 중": "bg-indigo-50 text-indigo-700",
  "복습 필요": "bg-amber-50 text-amber-700",
  완료: "bg-indigo-600 text-white",
}

export function StudySummary({
  stats,
  recordCount,
  onChangeStatus,
  onChangeUnderstanding,
  extra,
}: {
  stats: PageStats
  recordCount: number
  onChangeStatus: (status: PageStatus | null) => void
  onChangeUnderstanding: (understanding: number | null) => void
  // Template-specific line (e.g. 시험 정리: 범위 진행률).
  extra?: React.ReactNode
}) {
  const muted = "text-muted-foreground/70"
  return (
    <section aria-label="학습 요약" className="flex flex-col gap-3 rounded-xl border border-border px-4 py-3">
      <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-5">
        <Item label="상태">
          <span className="relative inline-flex">
            <span className={`pointer-events-none rounded px-1.5 py-0.5 text-xs font-medium ${statusStyles[stats.status]}`}>
              {stats.status}
            </span>
            <select
              aria-label="학습 상태 직접 고르기"
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
        </Item>
        <Item label="이해도">
          <span className="inline-flex items-center gap-1.5">
            <span role="group" aria-label="이해도 직접 고르기" className="flex">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => onChangeUnderstanding(n)}
                  aria-label={`이해도 ${n}`}
                  aria-pressed={stats.understanding === n}
                  className="group/bar flex h-5 items-center px-px"
                >
                  <span
                    className={`h-1.5 w-2.5 rounded-full transition-colors ${
                      n <= (stats.understanding ?? 0)
                        ? "bg-indigo-600 group-hover/bar:bg-indigo-500"
                        : "bg-border group-hover/bar:bg-indigo-200"
                    }`}
                  />
                </button>
              ))}
            </span>
            <span className="tabular-nums">{stats.understanding === null ? <span className={muted}>—</span> : `${stats.understanding}/5`}</span>
            {stats.understandingIsManual && (
              <button
                type="button"
                onClick={() => onChangeUnderstanding(null)}
                className="rounded px-1 text-xs text-muted-foreground/70 transition-colors hover:bg-muted hover:text-foreground"
              >
                기록 기준
              </button>
            )}
          </span>
        </Item>
        <Item label="학습 시간">
          {stats.totalDurationMinutes > 0 ? formatDuration(stats.totalDurationMinutes) : <span className={muted}>—</span>}
        </Item>
        <Item label="마지막 학습">{stats.lastStudiedAt ? formatDate(stats.lastStudiedAt) : <span className={muted}>—</span>}</Item>
        <Item label="다음 복습">
          {stats.nextReviewAt ? (
            <span className={stats.status === "복습 필요" ? "font-medium text-amber-700" : undefined}>
              {formatDate(stats.nextReviewAt)}
            </span>
          ) : (
            <span className={muted}>—</span>
          )}
        </Item>
      </dl>
      {extra}
      {recordCount === 0 && (
        <p className="text-xs text-muted-foreground/80">공부를 마치고 학습 기록을 남기면 다음 복습일이 정해져요.</p>
      )}
    </section>
  )
}

function Item({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-foreground">{children}</dd>
    </div>
  )
}
