"use client"

import { Fragment, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { BookOpen, ChevronRight, FileQuestion, Paperclip, PenLine, Plus, Printer, SlidersHorizontal, Sparkles } from "lucide-react"
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
import {
  applyStarter,
  descendantPages,
  nearestSubject,
  nodePath,
  setPageStudyEnabled,
  updatePage,
  updatePageProps,
  usePagePropsReady,
  useWorkspace,
} from "@/lib/workspace"
import { ExamScope } from "@/components/study-page/exam-scope"
import { PageStarters } from "@/components/study-page/page-starters"
import { isTextBlock, pageKind, problemBlocks, wrongProblems, type AttachmentBlock } from "@/lib/study-pages"
import { PagesContext } from "@/components/study-page/pages-context"
import { PageActionsMenu, menuItemClass } from "@/components/page-actions-menu"
import { BlockEditor, type AttachmentHandle } from "@/components/study-page/block-editor"
import { clearRecordPrefill, useStudySession } from "@/lib/study-session"
import { useTodayISO } from "@/hooks/use-today"
import { TagEditor } from "@/components/study-page/page-properties"
import { PageInfoPanel } from "@/components/study-page/page-info-panel"
import { PageStatusChip } from "@/components/study-page/page-status-chip"
import { PageRecords } from "@/components/study-page/page-records"
import { SessionIndicator } from "@/components/study-session/session-timer"
import { openQuickRecord } from "@/components/record/quick-record-dialog"
import { AiPanel } from "@/components/record/ai-panel"
import { LectureMaterialPane } from "@/components/study-page/lecture-material-pane"

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
  // 속성 window (D-28): opened from the top bar instead of sitting between the title and the body.
  const [infoOpen, setInfoOpen] = useState(false)
  const infoButtonRef = useRef<HTMLButtonElement>(null)

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

  // Study on:  [속성] → [복습 모드 (?mode=review)] → [본문] → [학습 기록] → [AI 학습 도구]
  // Study off: [본문] → [학습 기능 추가]
  const studyOn = isStudyOn(page)
  // Nothing written yet: offer templates. Typing anything (or adding any block) hides the row.
  const bodyEmpty = page.blocks.length === 0 || (page.blocks.length === 1 && isTextBlock(page.blocks[0]) && page.blocks[0].type === "p" && page.blocks[0].text === "")
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

  const pageHref = `/record/${page.id}`
  const reviewing = mode === "review" && studyOn
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
    .filter((p) => p.id !== page.id && isStudyOn(p))
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
        }
      : null
  const setTags = (tags: string[]) => updatePage(page.id, (p) => ({ ...p, tags }))
  const infoPanel = infoOpen && (
    <PageInfoPanel
      anchorRef={infoButtonRef}
      page={page}
      kind={kind}
      propsReady={propsReady}
      studyOn={studyOn}
      stats={stats}
      today={today}
      onClose={() => setInfoOpen(false)}
      onChangeTags={setTags}
      onChangeProps={(patch) => updatePageProps(page.id, patch)}
      onChangeStatus={(status) => updatePage(page.id, ({ status: _prev, ...rest }) => (status ? { ...rest, status } : rest))}
      onChangeUnderstanding={(understanding) =>
        updatePage(page.id, ({ understanding: _prev, ...rest }) => (understanding ? { ...rest, understanding } : rest))
      }
      pdfs={pdfs}
      scopeOptions={scopeOptions}
      problems={problems}
      retryHref={`${pageHref}?mode=review`}
    />
  )

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
        problemMode={problemReview ? { today } : undefined}
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
      {/* Top bar (D-28): where the note is on the left; on the right its study state, 속성, tools and the running
          session — the same place on every note, so the page itself is only the title and the body. */}
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
          {studyOn && !reviewing && (
            <PageStatusChip
              kind={kind}
              stats={stats}
              today={today}
              reviewHref={`${pageHref}?mode=review`}
              problems={problems}
              exam={examInfo}
              onOpenInfo={() => setInfoOpen(true)}
            />
          )}
          {studyOn && (
            <div className="relative">
              <button
                ref={infoButtonRef}
                type="button"
                data-info-toggle
                onClick={() => setInfoOpen((v) => !v)}
                aria-expanded={infoOpen}
                aria-haspopup="dialog"
                aria-label="속성"
                className={`inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-sm font-medium transition-colors sm:px-2.5 ${
                  infoOpen ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground"
                }`}
              >
                <SlidersHorizontal className="size-4" aria-hidden="true" />
                <span className="hidden sm:inline">속성</span>
              </button>
              {infoPanel}
            </div>
          )}
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
        {studyOn && examInfo && !reviewing && (
          <div id="exam-scope" className="mt-8 scroll-mt-24">
            <ExamScope examDate={page.props?.examDate} scope={scopePages} today={today} />
          </div>
        )}
        <div className="mt-6">{body}</div>
        {studyOn && !reviewing && (
          <div className="mt-10 print:hidden">
            <TagEditor tags={page.tags} onChange={setTags} size="md" />
          </div>
        )}
        {studyOn && (
          <div className="mt-16 print:hidden">
            <PageRecords page={page} stats={stats} today={today} subject={subject ?? null} />
          </div>
        )}

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
