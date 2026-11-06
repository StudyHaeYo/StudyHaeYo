"use client"

import { Fragment, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { BookOpen, ChevronRight, FileQuestion, Paperclip, PenLine, Printer, Sparkles } from "lucide-react"
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
import {
  applyStarter,
  descendantPages,
  discardIfUntouched,
  nearestSubject,
  nodePath,
  setAttachmentPath,
  updatePage,
  updatePageProps,
  usePagePropsReady,
  useWorkspace,
} from "@/lib/workspace"
import { ExamScope } from "@/components/study-page/exam-scope"
import { PageStarters } from "@/components/study-page/page-starters"
import { isTextBlock, pageKind, problemBlocks, reviewActionLabel, wrongProblems, type AttachmentBlock } from "@/lib/study-pages"
import { PagesContext } from "@/components/study-page/pages-context"
import { PageActionsMenu, menuItemClass } from "@/components/page-actions-menu"
import { BlockEditor, type AttachmentHandle } from "@/components/study-page/block-editor"
import { clearRecordPrefill, useStudySession } from "@/lib/study-session"
import { useTodayISO } from "@/hooks/use-today"
import { KindChip } from "@/components/study-page/kind-menu"
import { LectureHead, WrongAnswersHead } from "@/components/study-page/kind-head"
import { PageStatusChip } from "@/components/study-page/page-status-chip"
import { PageRecords } from "@/components/study-page/page-records"
import { SessionIndicator } from "@/components/study-session/session-timer"
import { openQuickRecord } from "@/components/record/quick-record-dialog"
import { AiPanel } from "@/components/record/ai-panel"
import { LectureMaterialPane } from "@/components/study-page/lecture-material-pane"
import { starterSectionHints } from "@/lib/templates"

// The page on screen, so leaving and coming straight back (or a remount) isn't taken as leaving.
let openPageId: string | null = null

// The single page UI: seeded pages and user-created pages both render here.
// Every page has the same block body (D-23) and every page can hold study records (D-30). What the note is for
// (노트 종류) is the chip in the top bar; the values a kind needs sit at the top of the body.
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
  const [aiOpen, setAiOpenState] = useState(openAi)
  // 강의 노트: the lecture PDF beside the note. It shares the right-hand slot with the AI panel.
  const [materialOpen, setMaterialOpen] = useState(false)
  const [aiRequest, setAiRequest] = useState<{ id: number; prompt: string; pdfId?: string } | undefined>()
  const setAiOpen = (next: boolean | ((v: boolean) => boolean)) =>
    setAiOpenState((v) => {
      const value = typeof next === "function" ? next(v) : next
      if (value) setMaterialOpen(false)
      return value
    })
  const propsReady = usePagePropsReady()

  // Leaving a just-made page that was never given anything removes it (lib/workspace.ts discardIfUntouched).
  // Checked a tick later so a remount of the same page (dev Strict Mode) doesn't count as leaving.
  useEffect(() => {
    openPageId = pageId
    return () => {
      if (openPageId === pageId) openPageId = null
      setTimeout(() => {
        if (openPageId !== pageId) discardIfUntouched(pageId)
      }, 0)
    }
  }, [pageId])

  // Time handed over from a finished timer session opens the record window for this note.
  useEffect(() => {
    if (!prefill || prefill.pageId !== pageId) return
    openQuickRecord({ pageId, minutes: prefill.minutes })
    clearRecordPrefill()
  }, [prefill, pageId])

  // Caret into the first empty body block (after a template fills the page, or Enter in the title).
  const focusBody = () =>
    requestAnimationFrame(() => {
      Array.from(document.querySelectorAll<HTMLTextAreaElement>("main article textarea"))
        .find((t) => t.value === "")
        ?.focus()
    })

  // Just made (?new=1). An untitled page keeps the caret in the title (autoFocus); a titled one starts in the body.
  useEffect(() => {
    if (!startTyping) return
    const frame = requestAnimationFrame(() => {
      if (titleRef.current?.value) focusBody()
      router.replace(`/record/${pageId}`, { scroll: false })
    })
    return () => cancelAnimationFrame(frame)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startTyping, pageId, router])

  if (!page) return dataStatus.phase === "ready" ? <MissingPage /> : <DataStatusView status={dataStatus} />

  // Nothing written yet: offer the kinds. Typing anything (or adding any block) hides the row.
  const bodyEmpty = page.blocks.length === 0 || (page.blocks.length === 1 && isTextBlock(page.blocks[0]) && page.blocks[0].type === "p" && page.blocks[0].text === "")
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

  const pageHref = `/record/${page.id}`
  const reviewing = mode === "review"
  // Review cards come from 핵심 개념 blocks. Without any, the review panel only asks for 이해도 and the
  // note stays readable below it.
  // 오답 노트 reviews the problems still wrong instead (D-27).
  const problemReview = propsReady && pageKind(page) === "wrong-answers"
  const concepts = problemReview ? wrongProblems(page.blocks) : conceptBlocks(page.blocks)

  const handleReviewComplete = (result: ReviewResult) => {
    if (result.confusedTexts.length > 0)
      updatePage(page.id, (p) => ({ ...p, blocks: addConfusions(p.blocks, result.confusedTexts) }))
    if (result.rightIds.length + result.wrongIds.length > 0) {
      const triedOn = today ?? todayISO()
      updatePage(page.id, (p) => ({
        ...p,
        blocks: p.blocks.map((b) =>
          !isTextBlock(b) || b.type !== "toggle"
            ? b
            : result.rightIds.includes(b.id)
              ? { ...b, result: "right" as const, triedOn }
              : result.wrongIds.includes(b.id)
                ? { ...b, result: "wrong" as const, triedOn }
                : b,
        ),
      }))
    }
    const now = Date.now()
    handleAddRecord({
      id: newRecordId(),
      pageId: page.id,
      date: today ?? todayISO(),
      createdAt: now,
      durationMinutes: result.durationMinutes,
      understanding: result.understanding,
      studyContent: problemReview
        ? `오답 다시 풀기: ${result.remembered.length + result.confused.length}문제 중 ${result.remembered.length}개 맞힘`
        : concepts.length > 0 ? `복습 모드: 핵심 개념 ${result.remembered.length + result.confused.length}개 확인` : "복습 모드: 노트 다시 읽기",
      difficulties: problemReview
        ? ""
        : result.confused.length > 0 ? `헷갈린 개념: ${result.confused.join(", ")}` : "",
      nextSteps: "",
      tags: [],
    })
    router.replace(pageHref)
  }

  const kind = pageKind(page)
  const pdfs = page.blocks.filter(
    (b): b is AttachmentBlock => (b.type === "file" || b.type === "image") && "mime" in b && b.mime === "application/pdf",
  )
  // 시험 범위 후보: the subject's other study pages, or every study page when the page has no subject.
  const scopeOptions = (subject ? descendantPages({ groups, pages }, subject.id) : pages)
    .filter((p) => p.id !== page.id && pageKind(p) !== "exam")
    .map((p) => ({ id: p.id, title: p.title }))
  const material = kind === "lecture" && propsReady ? pdfs.find((p) => p.id === page.props?.materialBlockId) : undefined
  const problems = { total: problemBlocks(page.blocks).length, wrong: wrongProblems(page.blocks).length }

  const scopePages = (page.props?.scope ?? []).map((id) => pages.find((p) => p.id === id)).filter((p) => p !== undefined)
  const examInfo =
    propsReady && kind === "exam"
      ? {
          date: page.props?.examDate,
          ready: scopePages.filter((p) => (computePageStats(p, today).understanding ?? 0) >= 4).length,
          total: scopePages.length,
          // "준비 0/2" before anything in scope has been studied reads like a failing grade; wait for a record.
          recorded: scopePages.filter((p) => computePageStats(p, today).understanding !== null).length,
        }
      : null
  const review = reviewing && (
    <StudyNoteReview
      concepts={concepts}
      exitHref={pageHref}
      onComplete={handleReviewComplete}
      mode={problemReview ? "problems" : "concepts"}
    />
  )
  const editor = (
    <div className="min-h-64">
      <BlockEditor
        blocks={page.blocks}
        onChange={(blocks) => updatePage(page.id, (p) => ({ ...p, blocks }))}
        allowAttachments
        attachRef={attachRef}
        onAttachmentStored={(blockId, path) => setAttachmentPath(page.id, blockId, path)}
        problemMode={problemReview ? { today } : undefined}
        sectionHints={starterSectionHints}
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


  return (
    <PagesContext.Provider value={pages}>
    {/* With the AI panel open on a wide screen, the page moves aside instead of going under it. */}
    <div
      className={`flex flex-col transition-[padding] ${aiOpen ? "md:pr-[420px]" : material && materialOpen ? "md:pr-[min(48vw,720px)]" : ""}`}
    >
      {/* Top bar (D-28, D-30): where the note is on the left; on the right its study state, its kind (종류 칩), tools
          and the running session — the same place on every note, so the page itself is only the title and the body. */}
      <header className="sticky top-12 z-20 border-b border-border bg-background/90 backdrop-blur print:hidden md:top-0">
        <div className="flex h-14 items-center justify-between gap-3 px-4 md:px-6">
          <nav aria-label="breadcrumb" className="flex min-w-0 items-center gap-1.5 text-sm">
            <span className="hidden shrink-0 text-muted-foreground lg:inline">내 페이지</span>
            {path.map((node, i) => (
              <Fragment key={node.id}>
                <ChevronRight className={`size-3.5 shrink-0 text-muted-foreground ${i === 0 ? "hidden lg:block" : "hidden md:block"}`} />
                {node.kind === "folder" ? (
                  <span className="hidden shrink-0 text-muted-foreground md:inline">{node.name}</span>
                ) : (
                  <Link
                    href={node.kind === "subject" ? `/subject/${node.id}` : `/record/${node.id}`}
                    className="hidden max-w-40 shrink-0 truncate text-muted-foreground transition-colors hover:text-foreground md:inline"
                  >
                    {node.name}
                  </Link>
                )}
              </Fragment>
            ))}
            <ChevronRight className={`size-3.5 shrink-0 text-muted-foreground ${path.length > 0 ? "hidden md:block" : "hidden lg:block"}`} />
            <span className="truncate font-medium text-foreground">{page.title.trim() || "제목 없음"}</span>
          </nav>
          <div className="flex shrink-0 items-center gap-1">
          {!reviewing && (
            <PageStatusChip
              kind={kind}
              stats={stats}
              today={today}
              reviewHref={`${pageHref}?mode=review`}
              problems={problems}
              exam={examInfo}
              action={reviewActionLabel(page)}
              canTryCards={!problemReview && concepts.length > 0}
            />
          )}
          <KindChip pageId={page.id} kind={kind} propsReady={propsReady} />
          {material && (
            <button
              type="button"
              onClick={() => {
                setAiOpenState(false)
                setMaterialOpen((v) => !v)
              }}
              aria-pressed={materialOpen}
              className={`inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-sm font-medium transition-colors ${
                materialOpen ? "bg-indigo-50 text-indigo-700" : "text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
            >
              <BookOpen className="size-4" />
              <span className="hidden sm:inline">강의 자료</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setAiOpen((v) => !v)}
            aria-pressed={aiOpen}
            className={`inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-sm font-medium transition-colors ${
              aiOpen ? "bg-indigo-50 text-indigo-700" : "text-muted-foreground hover:bg-accent hover:text-foreground"
            }`}
          >
            <Sparkles className="size-4" />
            <span className="hidden sm:inline">AI</span>
          </button>
          <PageActionsMenu
            pageId={page.id}
            title={page.title.trim() || "제목 없음"}
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
          <SessionDock />
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
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.nativeEvent.isComposing) {
              e.preventDefault()
              focusBody()
            }
          }}
          className="w-full bg-transparent text-4xl font-bold tracking-tight text-foreground outline-none placeholder:text-muted-foreground/40"
        />

        {bodyEmpty && mode !== "review" && (
          <PageStarters
            onPick={(starterId) => {
              applyStarter(page.id, starterId)
              focusBody()
            }}
            onAi={() => {
              applyStarter(page.id, "ai")
              setAiOpen(true)
              if (!page.title) titleRef.current?.focus()
            }}
          />
        )}
        {/* The values a kind needs, where they are used (D-30) — not in a 속성 window. */}
        {propsReady && !reviewing && kind === "exam" && (
          <div id="exam-scope" className="mt-8 scroll-mt-24 print:hidden">
            <ExamScope
              examDate={page.props?.examDate}
              onChangeDate={(examDate) => updatePageProps(page.id, { examDate })}
              scope={scopePages}
              options={scopeOptions}
              onChangeScope={(scope) => updatePageProps(page.id, { scope })}
              today={today}
            />
          </div>
        )}
        {propsReady && !reviewing && kind === "wrong-answers" && (
          <div className="mt-8 print:hidden">
            <WrongAnswersHead
              source={page.props?.source}
              onChange={(patch) => updatePageProps(page.id, patch)}
              problems={problems}
              retryHref={`${pageHref}?mode=review`}
            />
          </div>
        )}
        {propsReady && !reviewing && kind === "lecture" && (
          <div className="mt-8 print:hidden">
            <LectureHead
              props={page.props ?? {}}
              onChange={(patch) => updatePageProps(page.id, patch)}
              pdfs={pdfs}
              onUpload={(files) => {
                // The first lecture PDF becomes the material right away, so [나란히 보기] works without a second step.
                void attachRef.current?.attachAtTop(files).then((created) => {
                  const pdf = created.find((b) => "mime" in b && b.mime === "application/pdf")
                  if (pdf && !page.props?.materialBlockId) updatePageProps(page.id, { materialBlockId: pdf.id })
                })
              }}
              materialOpen={materialOpen}
              onToggleMaterial={() => {
                setAiOpenState(false)
                setMaterialOpen((v) => !v)
              }}
            />
          </div>
        )}
        <div className="mt-6">{body}</div>
        <div className="mt-16 print:hidden">
          <PageRecords page={page} stats={stats} today={today} subject={subject ?? null} />
        </div>


      </article>
    </div>
    {material && (
      <LectureMaterialPane
        block={material}
        open={materialOpen && !aiOpen}
        onClose={() => setMaterialOpen(false)}
        onChange={(next) => updatePage(page.id, (p) => ({ ...p, blocks: p.blocks.map((b) => (b.id === next.id ? next : b)) }))}
        onExtractConcepts={() => {
          setAiRequest({
            id: Date.now(),
            prompt: "이 강의 자료에서 시험에 나올 핵심 개념을 뽑아줘. \"## 핵심 개념\" 아래에 \"- 용어: 한 줄 설명\"으로 정리해줘.",
            pdfId: material.id,
          })
          setAiOpen(true)
        }}
      />
    )}
    <AiPanel
      page={page}
      request={aiRequest}
      open={aiOpen}
      onClose={() => setAiOpen(false)}
      onInsert={(blocks) => updatePage(page.id, (p) => ({ ...p, blocks: [...p.blocks, ...blocks] }))}
      onAddConfusions={(texts) => updatePage(page.id, (p) => ({ ...p, blocks: addConfusions(p.blocks, texts) }))}
    />
    </PagesContext.Provider>
  )
}

// The running timer, docked at the end of the top bar (the floating one is off on note pages).
function SessionDock() {
  return (
    <span className="ml-1 flex items-center gap-2 [&:not(:has(a))]:hidden">
      <span className="hidden h-5 w-px bg-border sm:block" aria-hidden="true" />
      <SessionIndicator />
    </span>
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
