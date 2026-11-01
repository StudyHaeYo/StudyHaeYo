"use client"

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react"
import { createPortal } from "react-dom"
import Link from "next/link"
import { X } from "lucide-react"
import {
  daysBetween,
  formatDate,
  formatDuration,
  pageStatuses,
  type AttachmentBlock,
  type PageKind,
  type PageProps,
  type PageStats,
  type PageStatus,
  type StudyPage,
} from "@/lib/study-pages"
import { nearestSubject, nodePath, useWorkspace } from "@/lib/workspace"
import { usePlans } from "@/lib/plans"
import { activePlans, subjectSummary } from "@/lib/study-stats"
import { kindLabels, PropertyRow, TagEditor, TemplateFields } from "@/components/study-page/page-properties"

const statusStyles: Record<PageStatus, string> = {
  "시작 전": "bg-muted text-muted-foreground",
  "학습 중": "bg-indigo-50 text-indigo-700",
  "복습 필요": "bg-amber-50 text-amber-700",
  완료: "bg-indigo-600 text-white",
}

// 속성 window (D-28): opened from the page's top bar, so the title runs straight into the body. Three parts —
// what the user sets, what the study records add up to, and what the note is connected to (plan · subject).
// A popover under the button on wide screens, a bottom sheet on phones.
export function PageInfoPanel({
  page,
  kind,
  propsReady,
  studyOn,
  stats,
  today,
  onClose,
  onChangeTags,
  onChangeProps,
  onChangeStatus,
  onChangeUnderstanding,
  pdfs,
  scopeOptions,
  problems,
  retryHref,
  anchorRef,
}: {
  // The 속성 button: on wide screens the window opens right under it.
  anchorRef: RefObject<HTMLElement | null>
  page: StudyPage
  kind: PageKind | null
  propsReady: boolean
  studyOn: boolean
  stats: PageStats
  today: string | null
  onClose: () => void
  onChangeTags: (tags: string[]) => void
  onChangeProps: (patch: Partial<PageProps>) => void
  onChangeStatus: (status: PageStatus | null) => void
  onChangeUnderstanding: (understanding: number | null) => void
  pdfs: AttachmentBlock[]
  scopeOptions: { id: string; title: string }[]
  problems: { total: number; wrong: number }
  retryHref?: string
}) {
  const workspace = useWorkspace()
  const plans = usePlans()
  const panelRef = useRef<HTMLDivElement>(null)
  // Portaled to <body>: the sticky top bar's backdrop blur would otherwise trap a fixed bottom sheet inside it.
  const [anchor, setAnchor] = useState<{ top: number; right: number } | null>(null)
  useLayoutEffect(() => {
    const place = () => {
      const rect = anchorRef.current?.getBoundingClientRect()
      if (rect) setAnchor({ top: rect.bottom + 8, right: Math.max(8, window.innerWidth - rect.right) })
    }
    place()
    window.addEventListener("resize", place)
    return () => window.removeEventListener("resize", place)
  }, [anchorRef])

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (panelRef.current?.contains(target) || target.closest("[data-info-toggle]")) return
      onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("mousedown", onDown)
    document.addEventListener("keydown", onKey)
    // Focus the window itself (not a field), so a phone doesn't pop the keyboard just to look.
    panelRef.current?.focus({ preventScroll: true })
    return () => {
      document.removeEventListener("mousedown", onDown)
      document.removeEventListener("keydown", onKey)
    }
  }, [onClose])

  const subject = nearestSubject(workspace, page.parentId)
  const subjectInfo = subject ? subjectSummary(workspace, subject.id) : null
  // Plans running today that this note's study counts toward: 전체, its subject (or one above it), or the note.
  const ancestorIds = new Set(nodePath(workspace, page.parentId).map((n) => n.id))
  const related = today
    ? activePlans(workspace, plans, today).filter(({ plan }) => {
        const t = plan.target
        if (t.scope === "all") return true
        if (t.scope === "subject") return ancestorIds.has(t.subjectId)
        return t.pageId === page.id || ancestorIds.has(t.pageId)
      })
    : []
  const overdue = stats.nextReviewAt && today ? daysBetween(stats.nextReviewAt, today) : 0
  const muted = "text-muted-foreground/70"

  return createPortal(
    <>
      <div className="fixed inset-0 z-40 bg-foreground/25 md:hidden" aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-label="페이지 속성"
        tabIndex={-1}
        style={anchor ? ({ "--top": `${anchor.top}px`, "--right": `${anchor.right}px` } as React.CSSProperties) : undefined}
        className="fixed inset-x-2 bottom-2 z-50 max-h-[80dvh] overflow-y-auto overscroll-contain rounded-3xl border border-border bg-popover p-2 shadow-2xl outline-none md:bottom-auto md:left-auto md:right-[var(--right)] md:top-[var(--top)] md:max-h-[calc(100dvh-var(--top)-16px)] md:w-[23rem] md:rounded-2xl"
      >
        <div className="mx-auto mb-1 mt-1 h-1 w-9 rounded-full bg-border md:hidden" aria-hidden="true" />
        <div className="flex items-center justify-between px-2.5 pt-1">
          <Section>직접 정하는 것</Section>
          <button
            type="button"
            onClick={onClose}
            aria-label="속성 닫기"
            className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>
        <dl className="flex flex-col">
          <PropertyRow label="종류">
            <span className="px-1.5">{kind ? kindLabels[kind] : studyOn ? "학습 노트" : "페이지"}</span>
          </PropertyRow>
          {propsReady && (
            <TemplateFields
              kind={kind}
              props={page.props ?? {}}
              onChangeProps={onChangeProps}
              pdfs={pdfs}
              scopeOptions={scopeOptions}
              problems={problems}
              retryHref={retryHref}
              today={today}
            />
          )}
          <PropertyRow label="태그">
            <TagEditor tags={page.tags} onChange={onChangeTags} />
          </PropertyRow>
        </dl>

        {studyOn && (
          <>
            <hr className="mx-2 my-1.5 border-border" />
            <Section>학습 기록에서 계산</Section>
            <dl className="flex flex-col">
              <PropertyRow label="상태">
                <span className="relative inline-flex px-1.5">
                  <span className={`pointer-events-none rounded px-1.5 py-0.5 text-xs font-semibold ${statusStyles[stats.status]}`}>
                    {stats.status}
                    {stats.statusIsManual && " · 직접"}
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
              </PropertyRow>
              <PropertyRow label="이해도">
                <span className="inline-flex items-center gap-1.5 px-1">
                  <span role="group" aria-label="이해도 직접 고르기" className="flex">
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
                            n <= (stats.understanding ?? 0) ? "bg-indigo-600 group-hover/bar:bg-indigo-500" : "bg-indigo-100 group-hover/bar:bg-indigo-200"
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
                      className="rounded px-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      기록 기준
                    </button>
                  )}
                </span>
              </PropertyRow>
              <PropertyRow label="학습 시간">
                <span className="px-1.5">
                  {stats.totalDurationMinutes > 0 ? (
                    `${formatDuration(stats.totalDurationMinutes)} · 기록 ${page.studyRecords.length}개`
                  ) : (
                    <span className={muted}>아직 없어요</span>
                  )}
                </span>
              </PropertyRow>
              <PropertyRow label="다음 복습">
                <span className="px-1.5">
                  {stats.nextReviewAt ? (
                    <>
                      {formatDate(stats.nextReviewAt)}
                      {overdue > 0 && <span className="ml-1.5 text-xs font-semibold text-amber-700">{overdue}일 지남</span>}
                      {overdue === 0 && stats.status === "복습 필요" && <span className="ml-1.5 text-xs font-semibold text-amber-700">오늘</span>}
                    </>
                  ) : (
                    <span className={muted}>기록을 남기면 정해져요</span>
                  )}
                </span>
              </PropertyRow>
            </dl>

            {(related.length > 0 || subject) && (
              <>
                <hr className="mx-2 my-1.5 border-border" />
                <Section>연결</Section>
                <dl className="flex flex-col pb-1">
                  {related.slice(0, 2).map(({ plan, studiedMinutes, elapsedDays, totalDays }) => {
                    const ratio = plan.goalMinutes ? studiedMinutes / plan.goalMinutes : elapsedDays / Math.max(1, totalDays)
                    return (
                      <PropertyRow key={plan.id} label="계획">
                        <Link href="/plan" className="block rounded-md px-1.5 py-0.5 hover:bg-muted/60">
                          <span className="font-semibold text-indigo-700">{plan.title}</span>{" "}
                          <span className="text-xs text-muted-foreground">
                            {formatDuration(studiedMinutes)}
                            {plan.goalMinutes ? ` / ${formatDuration(plan.goalMinutes)}` : ""}
                          </span>
                          <span className="mt-1 block h-1 overflow-hidden rounded-full bg-indigo-100" aria-hidden="true">
                            <span className="block h-full rounded-full bg-indigo-600" style={{ width: `${Math.min(100, Math.round(ratio * 100))}%` }} />
                          </span>
                        </Link>
                      </PropertyRow>
                    )
                  })}
                  {subject && (
                    <PropertyRow label="과목">
                      <Link href={`/subject/${subject.id}`} className="rounded-md px-1.5 py-0.5 hover:bg-muted/60">
                        <span className="font-semibold text-indigo-700">{subject.name}</span>
                        {subjectInfo?.averageUnderstanding != null && (
                          <span className="ml-1.5 text-xs text-muted-foreground">평균 이해도 {subjectInfo.averageUnderstanding.toFixed(1)}</span>
                        )}
                      </Link>
                    </PropertyRow>
                  )}
                </dl>
              </>
            )}
          </>
        )}
      </div>
    </>,
    document.body,
  )
}

function Section({ children }: { children: ReactNode }) {
  return <p className="px-2.5 pb-1 pt-1.5 text-[11px] font-medium text-muted-foreground">{children}</p>
}
