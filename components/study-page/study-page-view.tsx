"use client"

import { Fragment, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ChevronRight, FileQuestion, Lock, MoreHorizontal, Paperclip, PenLine, Plus, PowerOff } from "lucide-react"
import {
  computePageStats,
  newItemId,
  newRecordId,
  noteOf,
  todayISO,
  type PageStudyRecord,
  type StudyNoteContent,
} from "@/lib/study-pages"
import { useDataStatus } from "@/lib/db/sync"
import { DataStatusView } from "@/components/data-status-notice"
import type { ReviewResult } from "@/components/study-page/study-note-review"
import { resolvePageLayout } from "@/lib/templates"
import { nearestSubject, nodePath, setPageStudyEnabled, updatePage, useWorkspace } from "@/lib/workspace"
import { PageActionsMenu, menuItemClass } from "@/components/page-actions-menu"
import type { AttachmentHandle } from "@/components/study-page/block-editor"
import { clearRecordPrefill, useStudySession } from "@/lib/study-session"
import { useTodayISO } from "@/hooks/use-today"
import { PageProperties } from "@/components/study-page/page-properties"
import { StudyHistory } from "@/components/study-page/study-history"
import { AiToolsSection } from "@/components/record/ai-tools-section"

// The single page UI: seeded pages and user-created pages both render here.
// What renders is decided by the page type (template) via resolvePageLayout.
export function StudyPageView({ pageId, mode }: { pageId: string; mode?: "review" }) {
  const { groups, pages } = useWorkspace()
  const today = useTodayISO()
  const router = useRouter()
  const { prefill } = useStudySession()
  const titleRef = useRef<HTMLInputElement>(null)
  const attachRef = useRef<AttachmentHandle>(null)
  const page = pages.find((p) => p.id === pageId)
  const dataStatus = useDataStatus()

  if (!page) return dataStatus.phase === "ready" ? <MissingPage /> : <DataStatusView status={dataStatus} />

  // Every page type shares one column:
  // Study on:  [속성] → [본문 템플릿 or 복습 모드] → [학습 기록] → [AI 학습 도구]
  // Study off: [본문 템플릿] → [학습 기능 추가]
  const layout = resolvePageLayout(page)
  const { Body, ReviewBody } = layout
  const pagePrefill = prefill?.pageId === page.id ? prefill : null
  const setStudyEnabled = (studyEnabled: boolean) => setPageStudyEnabled(page.id, studyEnabled)
  const path = nodePath({ groups, pages }, page.parentId)
  const subject = nearestSubject({ groups, pages }, page.parentId)
  const stats = computePageStats(page, today)

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

  const pageHref = `/record/${page.id}`
  const reviewing = mode === "review" && ReviewBody !== null
  const changeNote = (note: StudyNoteContent) => updatePage(page.id, (p) => ({ ...p, note }))

  const handleReviewComplete = (result: ReviewResult) => {
    const note = noteOf(page)
    const openTexts = new Set(note.confusions.filter((q) => !q.resolved).map((q) => q.text.trim()))
    const newConfusions = result.confusedTexts
      .filter((text) => !openTexts.has(text.trim()))
      .map((text) => ({ id: newItemId("q"), text, resolved: false }))
    if (newConfusions.length > 0) changeNote({ ...note, confusions: [...note.confusions, ...newConfusions] })
    const now = Date.now()
    handleAddRecord({
      id: newRecordId(),
      pageId: page.id,
      date: today ?? todayISO(),
      createdAt: now,
      durationMinutes: result.durationMinutes,
      understanding: result.understanding,
      studyContent: `복습 모드: 핵심 개념 ${result.remembered.length + result.confused.length}개 확인`,
      difficulties: result.confused.length > 0 ? `헷갈린 개념: ${result.confused.join(", ")}` : "",
      nextSteps: "",
      tags: [],
    })
    router.replace(pageHref)
  }

  const properties = (
    <PageProperties
      subjectName={subject?.name ?? null}
      stats={stats}
      recordCount={page.studyRecords.length}
      tags={page.tags}
      onChangeTags={(tags) => updatePage(page.id, (p) => ({ ...p, tags }))}
      onChangeStatus={(status) =>
        updatePage(page.id, ({ status: _prev, ...rest }) => (status ? { ...rest, status } : rest))
      }
      onChangeUnderstanding={(understanding) =>
        updatePage(page.id, ({ understanding: _prev, ...rest }) => (understanding ? { ...rest, understanding } : rest))
      }
    />
  )

  const body =
    reviewing && ReviewBody ? (
      <ReviewBody
        note={noteOf(page)}
        exitHref={pageHref}
        onComplete={handleReviewComplete}
      />
    ) : (
      <Body
        blocks={page.blocks}
        note={page.note}
        onChangeBlocks={(blocks) => updatePage(page.id, (p) => ({ ...p, blocks }))}
        onChangeNote={changeNote}
        attachRef={attachRef}
      />
    )

  const renderStudyArea = () => (
    <>
      <div className="mb-8 mt-16 flex items-center gap-3">
        <hr className="flex-1 border-border" />
        <StudyFeaturesMenu locked={layout.studyControl === "locked"} onDisable={() => setStudyEnabled(false)} />
      </div>
      <div className="flex flex-col gap-12">
        <StudyHistory
          pageId={page.id}
          pageTitle={page.title}
          records={page.studyRecords}
          onAdd={handleAddRecord}
          onUpdate={handleUpdateRecord}
          onDelete={handleDeleteRecord}
          prefill={pagePrefill}
          onPrefillDone={clearRecordPrefill}
        />
        <AiToolsSection
          page={page}
          onInsert={(blocks) =>
            updatePage(page.id, (p) =>
              p.note ? { ...p, note: { ...p.note, learned: [...p.note.learned, ...blocks] } } : { ...p, blocks: [...p.blocks, ...blocks] },
            )
          }
        />
      </div>
    </>
  )

  return (
    <div className="flex flex-col">
      <header className="sticky top-12 z-10 border-b md:top-0 border-border bg-background/95 backdrop-blur">
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
          <div className="flex shrink-0 items-center gap-1">
          <PageActionsMenu
            pageId={page.id}
            title={page.title.trim() || "제목 없음"}
            showStudyToggle
            extraItems={
              reviewing
                ? undefined
                : (close) => (
                    <>
                      <button
                        role="menuitem"
                        type="button"
                        title="끌어다 놓거나 이미지를 붙여넣어도 첨부돼요 · 파일당 10MB까지"
                        className={`${menuItemClass} text-foreground`}
                        onClick={() => {
                          close()
                          attachRef.current?.openPicker()
                        }}
                      >
                        <Paperclip className="size-4 text-muted-foreground" />
                        파일 첨부
                      </button>
                      <button
                        role="menuitem"
                        type="button"
                        title="펜과 형광펜으로 그릴 수 있는 블록을 넣어요"
                        className={`${menuItemClass} text-foreground`}
                        onClick={() => {
                          close()
                          attachRef.current?.insertDrawing()
                        }}
                      >
                        <PenLine className="size-4 text-muted-foreground" />
                        그림 추가
                      </button>
                    </>
                  )
            }
            onRename={() => {
              titleRef.current?.focus()
              titleRef.current?.select()
            }}
            onDeleted={() => router.push("/")}
          />
          </div>
        </div>
      </header>

      <article className="mx-auto flex w-full max-w-3xl flex-col px-6 pb-24 pt-12 lg:px-10">
        <label htmlFor="page-title" className="sr-only">
          페이지 제목
        </label>
        <input
          id="page-title"
          ref={titleRef}
          value={page.title}
          onChange={(e) => updatePage(page.id, (p) => ({ ...p, title: e.target.value }))}
          placeholder="제목 없음"
          autoFocus={!page.title}
          className="w-full bg-transparent text-4xl font-bold tracking-tight text-foreground outline-none placeholder:text-muted-foreground/40"
        />

        {layout.studyOn && <div className="mt-4">{properties}</div>}
        <hr className="my-6 border-border" />
        {body}
        {layout.studyOn && renderStudyArea()}

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
                    {`보관 중인 학습 기록 ${page.studyRecords.length}개가 있어요. 다시 추가하면 그대로 표시돼요.`}
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
        className="mt-5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
      >
        홈으로
      </Link>
    </div>
  )
}
