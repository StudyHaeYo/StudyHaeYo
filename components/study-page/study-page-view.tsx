"use client"

import { Fragment, useState } from "react"
import Link from "next/link"
import { Check, ChevronRight, FileQuestion, Lock, MoreHorizontal, Plus, PowerOff, Save } from "lucide-react"
import { computePageStats, type PageStudyRecord } from "@/lib/study-pages"
import { resolvePageLayout } from "@/lib/templates"
import { nearestSubject, nodePath, updatePage, useWorkspace } from "@/lib/workspace"
import { clearRecordPrefill, useStudySession } from "@/lib/study-session"
import { useTodayISO } from "@/hooks/use-today"
import { PageProperties } from "@/components/study-page/page-properties"
import { StudyHistory } from "@/components/study-page/study-history"
import { AiToolsSection } from "@/components/record/ai-tools-section"

// The single page UI: seeded pages and user-created pages both render here.
// What renders is decided by the page type (template) via resolvePageLayout.
export function StudyPageView({ pageId }: { pageId: string }) {
  const { groups, pages } = useWorkspace()
  const today = useTodayISO()
  const { prefill } = useStudySession()
  const [saved, setSaved] = useState(false)
  const page = pages.find((p) => p.id === pageId)

  if (!page) return <MissingPage />

  // Study on (any type):  [속성 패널] → [본문 템플릿] → [학습 기록] → [AI 학습 도구]
  // Study off (optional): [본문 템플릿] → [학습 기능 추가]
  const layout = resolvePageLayout(page)
  const { Body } = layout
  const pagePrefill = prefill?.pageId === page.id ? prefill : null
  const setStudyEnabled = (studyEnabled: boolean) => updatePage(page.id, (p) => ({ ...p, studyEnabled }))
  const path = nodePath({ groups, pages }, page.parentId)
  const subject = nearestSubject({ groups, pages }, page.parentId)
  const stats = computePageStats(page, today)

  const handleSave = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  const handleAddRecord = (record: PageStudyRecord) => {
    // A new record reflects the latest study session, so it takes over from manually picked values.
    updatePage(page.id, ({ status: _s, understanding: _u, ...p }) => ({
      ...p,
      studyRecords: [...p.studyRecords, record],
    }))
  }

  const handleUpdateRecord = (record: PageStudyRecord) => {
    updatePage(page.id, (p) => ({
      ...p,
      studyRecords: p.studyRecords.map((r) => (r.id === record.id ? record : r)),
    }))
  }

  const handleDeleteRecord = (recordId: string) => {
    updatePage(page.id, (p) => ({
      ...p,
      studyRecords: p.studyRecords.filter((r) => r.id !== recordId),
    }))
  }

  return (
    <div className="flex flex-col">
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-6 py-3 lg:px-10">
          <nav aria-label="breadcrumb" className="flex min-w-0 items-center gap-1.5 text-sm">
            <span className="shrink-0 text-muted-foreground">내 페이지</span>
            {path.map((node) => (
              <Fragment key={node.id}>
                <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
                {node.kind === "folder" ? (
                  <span className="shrink-0 text-muted-foreground">{node.name}</span>
                ) : (
                  <Link
                    href={node.kind === "subject" ? `/subject/${node.id}` : `/record/${node.id}`}
                    className="max-w-40 shrink-0 truncate text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {node.name}
                  </Link>
                )}
              </Fragment>
            ))}
            <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="truncate font-medium text-foreground">{page.title.trim() || "제목 없음"}</span>
          </nav>
          <button
            onClick={handleSave}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-700"
          >
            {saved ? <Check className="size-4" /> : <Save className="size-4" />}
            {saved ? "저장됨" : "저장"}
          </button>
        </div>
      </header>

      <article className="mx-auto flex w-full max-w-3xl flex-col px-6 pb-24 pt-12 lg:px-10">
        <label htmlFor="page-title" className="sr-only">
          페이지 제목
        </label>
        <input
          id="page-title"
          value={page.title}
          onChange={(e) => updatePage(page.id, (p) => ({ ...p, title: e.target.value }))}
          placeholder="제목 없음"
          autoFocus={!page.title}
          className="w-full bg-transparent text-4xl font-bold tracking-tight text-foreground outline-none placeholder:text-muted-foreground/40"
        />

        {layout.studyOn && (
          <div className="mt-4">
            <PageProperties
              subjectName={subject?.name ?? path.at(-1)?.name ?? "내 페이지"}
              stats={stats}
              recordCount={page.studyRecords.length}
              tags={page.tags}
              onChangeTags={(tags) => updatePage(page.id, (p) => ({ ...p, tags }))}
              onChangeStatus={(status) =>
                updatePage(page.id, ({ status: _prev, ...rest }) => (status ? { ...rest, status } : rest))
              }
              onChangeUnderstanding={(understanding) =>
                updatePage(page.id, ({ understanding: _prev, ...rest }) =>
                  understanding ? { ...rest, understanding } : rest,
                )
              }
            />
          </div>
        )}

        <hr className="my-6 border-border" />

        <Body blocks={page.blocks} onChange={(blocks) => updatePage(page.id, (p) => ({ ...p, blocks }))} />

        {!layout.studyOn && (
          <>
            <hr className="mb-8 mt-16 border-border" />
            <section
              aria-labelledby="study-features-heading"
              className="flex flex-col items-start gap-3 rounded-xl border border-dashed border-border px-5 py-5"
            >
              <div className="flex flex-col gap-1">
                <h2 id="study-features-heading" className="text-base font-semibold text-foreground">
                  학습 기능
                </h2>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  학습 기록과 AI 학습 도구를 사용할 수 있습니다.
                </p>
                {page.studyRecords.length > 0 && (
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {`보관 중인 ��습 기록 ${page.studyRecords.length}개가 있어요. 다시 추가하면 그대로 표시돼요.`}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setStudyEnabled(true)}
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-foreground transition-colors hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700"
              >
                <Plus className="size-4" />
                학습 기능 추가
              </button>
            </section>
          </>
        )}

        {layout.studyOn && (
          <>
            <div className="mb-8 mt-16 flex items-center gap-3">
              <hr className="flex-1 border-border" />
              <StudyFeaturesMenu
                locked={layout.studyControl === "locked"}
                onDisable={() => setStudyEnabled(false)}
              />
            </div>
            <div className="flex flex-col gap-12">
              <StudyHistory
                pageId={page.id}
                records={page.studyRecords}
                onAdd={handleAddRecord}
                onUpdate={handleUpdateRecord}
                onDelete={handleDeleteRecord}
                prefill={pagePrefill}
                onPrefillDone={clearRecordPrefill}
              />
              <AiToolsSection />
            </div>
          </>
        )}
      </article>
    </div>
  )
}

function StudyFeaturesMenu({ locked, onDisable }: { locked: boolean; onDisable: () => void }) {
  const [open, setOpen] = useState(false)

  return (
    <div
      className="relative"
      onKeyDown={(e) => {
        if (e.key === "Escape") setOpen(false)
      }}
    >
      <button
        type="button"
        aria-label="학습 기능 메뉴"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        학습 기능
        <MoreHorizontal className="size-4" aria-hidden="true" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" aria-hidden="true" onClick={() => setOpen(false)} />
          <div
            role="menu"
            className="absolute right-0 top-full z-20 mt-1 w-56 rounded-lg border border-border bg-background p-1 shadow-lg"
          >
            {locked ? (
              <div role="menuitem" aria-disabled="true" tabIndex={-1} className="flex gap-2 px-2.5 py-2">
                <Lock className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <p className="text-xs leading-relaxed text-muted-foreground">
                  이 페이지는 항상 학습 기록으로 추적됩니다
                </p>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  role="menuitem"
                  autoFocus
                  onClick={() => {
                    setOpen(false)
                    onDisable()
                  }}
                  className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm text-foreground transition-colors hover:bg-muted"
                >
                  <PowerOff className="size-4 text-muted-foreground" aria-hidden="true" />
                  학습 기능 끄기
                </button>
                <p className="px-2.5 pb-1.5 text-xs leading-relaxed text-muted-foreground">
                  본문과 학습 기록은 삭제되지 않아요.
                </p>
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}

export function MissingPage() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-6 py-32 text-center">
      <span className="mb-4 flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <FileQuestion className="size-6" />
      </span>
      <h1 className="text-base font-medium text-foreground">페이지를 찾을 수 없어요</h1>
      <p className="mt-1 text-sm text-muted-foreground">삭제되었거나 존재하지 않는 페이지예요.</p>
      <Link
        href="/"
        className="mt-5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-700"
      >
        홈으로
      </Link>
    </div>
  )
}
