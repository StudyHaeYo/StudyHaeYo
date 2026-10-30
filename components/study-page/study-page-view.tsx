"use client"

import { Fragment, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ChevronRight, FileQuestion, MoreHorizontal, Paperclip, PenLine, Plus, PowerOff, Printer, Sparkles } from "lucide-react"
import {
  addConfusions,
  computePageStats,
  conceptBlocks,
  newRecordId,
  todayISO,
  type PageStudyRecord,
} from "@/lib/study-pages"
import { useDataStatus } from "@/lib/db/sync"
import { DataStatusView } from "@/components/data-status-notice"
import { StudyNoteReview, type ReviewResult } from "@/components/study-page/study-note-review"
import { isStudyOn } from "@/lib/templates"
import { nearestSubject, nodePath, setPageStudyEnabled, updatePage, useWorkspace } from "@/lib/workspace"
import { PagesContext } from "@/components/study-page/pages-context"
import { PageActionsMenu, menuItemClass } from "@/components/page-actions-menu"
import { BlockEditor, type AttachmentHandle } from "@/components/study-page/block-editor"
import { clearRecordPrefill, useStudySession } from "@/lib/study-session"
import { useTodayISO } from "@/hooks/use-today"
import { PageProperties } from "@/components/study-page/page-properties"
import { StudyHistory } from "@/components/study-page/study-history"
import { AiPanel } from "@/components/record/ai-panel"

// The single page UI: seeded pages and user-created pages both render here.
// Every page has the same block body (D-23); study features (속성 · 학습 기록 · AI 도구) are on or off per page.
export function StudyPageView({
  pageId,
  mode,
  openAi = false,
  startTyping = false,
}: {
  pageId: string
  mode?: "review"
  openAi?: boolean
  // Just made in the new-page flow (?new=1): put the caret in the first empty block so typing starts right away.
  startTyping?: boolean
}) {
  const { groups, pages } = useWorkspace()
  const today = useTodayISO()
  const router = useRouter()
  const { prefill } = useStudySession()
  const titleRef = useRef<HTMLInputElement>(null)
  const attachRef = useRef<AttachmentHandle>(null)
  const page = pages.find((p) => p.id === pageId)
  const dataStatus = useDataStatus()
  const [aiOpen, setAiOpen] = useState(openAi)

  useEffect(() => {
    if (!startTyping) return
    const frame = requestAnimationFrame(() => {
      const empty = Array.from(document.querySelectorAll<HTMLTextAreaElement>("main article textarea")).find(
        (t) => t.value === "",
      )
      empty?.focus()
      router.replace(`/record/${pageId}`, { scroll: false })
    })
    return () => cancelAnimationFrame(frame)
  }, [startTyping, pageId, router])

  if (!page) return dataStatus.phase === "ready" ? <MissingPage /> : <DataStatusView status={dataStatus} />

  // Study on:  [속성] → [복습 모드 (?mode=review)] → [본문] → [학습 기록] → [AI 학습 도구]
  // Study off: [본문] → [학습 기능 추가]
  const studyOn = isStudyOn(page)
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
  const reviewing = mode === "review" && studyOn
  // Review cards come from 핵심 개념 blocks. Without any, the review panel only asks for 이해도 and the
  // note stays readable below it.
  const concepts = conceptBlocks(page.blocks)

  const handleReviewComplete = (result: ReviewResult) => {
    if (result.confusedTexts.length > 0)
      updatePage(page.id, (p) => ({ ...p, blocks: addConfusions(p.blocks, result.confusedTexts) }))
    const now = Date.now()
    handleAddRecord({
      id: newRecordId(),
      pageId: page.id,
      date: today ?? todayISO(),
      createdAt: now,
      durationMinutes: result.durationMinutes,
      understanding: result.understanding,
      studyContent:
        concepts.length > 0 ? `복습 모드: 핵심 개념 ${result.remembered.length + result.confused.length}개 확인` : "복습 모드: 노트 다시 읽기",
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

  const review = reviewing && (
    <StudyNoteReview concepts={concepts} exitHref={pageHref} onComplete={handleReviewComplete} />
  )
  const editor = (
    <div className="min-h-64">
      <BlockEditor
        blocks={page.blocks}
        onChange={(blocks) => updatePage(page.id, (p) => ({ ...p, blocks }))}
        allowAttachments
        attachRef={attachRef}
      />
    </div>
  )
  // With concept cards the review replaces the body (no peeking); without, the body is what gets reviewed.
  const body = !review ? (
    editor
  ) : concepts.length > 0 ? (
    review
  ) : (
    <div className="flex flex-col gap-8">
      {review}
      {editor}
    </div>
  )

  const renderStudyArea = () => (
    <>
      <div className="mb-8 mt-16 flex items-center gap-3">
        <hr className="flex-1 border-border" />
        <StudyFeaturesMenu onDisable={() => setStudyEnabled(false)} />
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
      </div>
    </>
  )

  return (
    <PagesContext.Provider value={pages}>
    {/* With the AI panel open on a wide screen, the page moves aside instead of going under it. */}
    <div className={`flex flex-col transition-[padding] ${aiOpen ? "md:pr-[420px]" : ""}`}>
      <header className="sticky top-12 z-10 border-b print:hidden md:top-0 border-border bg-background/95 backdrop-blur">
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
          <button
            type="button"
            onClick={() => setAiOpen((v) => !v)}
            aria-pressed={aiOpen}
            className={`inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-sm font-medium transition-colors ${
              aiOpen ? "bg-indigo-50 text-indigo-700" : "text-muted-foreground hover:bg-accent hover:text-foreground"
            }`}
          >
            <Sparkles className="size-4" />
            AI
          </button>
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
                      <button
                        role="menuitem"
                        type="button"
                        title="본문만 인쇄해요. 인쇄 창에서 'PDF로 저장'을 고르면 PDF 파일이 돼요"
                        className={`${menuItemClass} text-foreground`}
                        onClick={() => {
                          close()
                          setAiOpen(false)
                          requestAnimationFrame(() => window.print())
                        }}
                      >
                        <Printer className="size-4 text-muted-foreground" />
                        인쇄 · PDF로 저장
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

        {studyOn && <div className="mt-4 print:hidden">{properties}</div>}
        <hr className="my-6 border-border print:hidden" />
        {body}
        {studyOn && <div className="print:hidden">{renderStudyArea()}</div>}

        {!studyOn && (
          <div className="print:hidden">
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
                  학습 기록, 복습 일정, 복습 모드를 사용할 수 있어요. AI 도우미는 학습 기능 없이도 위의 AI 버튼으로 열 수 있어요.
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
          </div>
        )}

      </article>
    </div>
    <AiPanel
      page={page}
      open={aiOpen}
      onClose={() => setAiOpen(false)}
      onInsert={(blocks) => updatePage(page.id, (p) => ({ ...p, blocks: [...p.blocks, ...blocks] }))}
      onAddConfusions={(texts) => updatePage(page.id, (p) => ({ ...p, blocks: addConfusions(p.blocks, texts) }))}
    />
    </PagesContext.Provider>
  )
}

function StudyFeaturesMenu({ onDisable }: { onDisable: () => void }) {
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
