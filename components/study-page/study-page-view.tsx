"use client"

import { Fragment, useState } from "react"
import Link from "next/link"
import { Check, ChevronRight, FileQuestion, NotebookPen, Plus, Save } from "lucide-react"
import { computePageStats, type PageStudyRecord } from "@/lib/study-pages"
import { canToggleStudy, hasStudyFeatures, templates } from "@/lib/templates"
import { nearestSubject, nodePath, updatePage, useWorkspace } from "@/lib/workspace"
import { useTodayISO } from "@/hooks/use-today"
import { BlockEditor } from "@/components/study-page/block-editor"
import { PageProperties } from "@/components/study-page/page-properties"
import { StudyHistory } from "@/components/study-page/study-history"
import { AiToolsSection } from "@/components/record/ai-tools-section"

// The single page UI: seeded pages and user-created pages both render here.
// Which sections appear is decided by the page's template.
export function StudyPageView({ pageId }: { pageId: string }) {
  const { groups, pages } = useWorkspace()
  const today = useTodayISO()
  const [saved, setSaved] = useState(false)
  const page = pages.find((p) => p.id === pageId)

  if (!page) return <MissingPage />

  const studyOn = hasStudyFeatures(page)
  const toggleable = canToggleStudy(page)
  const isStudyNote = page.templateId === "study-note"
  const setStudyEnabled = (studyEnabled: boolean) => updatePage(page.id, (p) => ({ ...p, studyEnabled }))
  const sections = studyOn
    ? { properties: true, studyHistory: true, aiTools: true }
    : templates[page.templateId].sections
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

        {toggleable && studyOn && (
          <div className="mt-4 flex items-center justify-between gap-3 rounded-md px-2 text-xs text-muted-foreground">
            <span>자유 페이지 · 학습 기능 사용 중</span>
            <StudyToggle checked onChange={setStudyEnabled} />
          </div>
        )}

        {sections.properties && (
          <div className={toggleable ? "mt-1" : "mt-4"}>
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

        {isStudyNote ? (
          <section
            aria-labelledby="study-note-body-heading"
            className="rounded-xl border border-indigo-100 bg-indigo-50/30"
          >
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-indigo-100 px-5 py-3">
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-indigo-700">
                <NotebookPen className="size-4" aria-hidden="true" />
                <span id="study-note-body-heading">학습 노트</span>
              </span>
              <span className="text-xs text-muted-foreground">오늘 배운 내용 · 핵심 개념 · 헷갈린 점</span>
            </div>
            <div className="min-h-64 px-5 py-4">
              <BlockEditor
                blocks={page.blocks}
                onChange={(blocks) => updatePage(page.id, (p) => ({ ...p, blocks }))}
              />
            </div>
          </section>
        ) : (
          <div className="min-h-64">
            <BlockEditor
              blocks={page.blocks}
              onChange={(blocks) => updatePage(page.id, (p) => ({ ...p, blocks }))}
            />
          </div>
        )}

        {toggleable && !studyOn && (
          <div className="mt-10">
            <button
              type="button"
              onClick={() => setStudyEnabled(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-dashed border-border px-3 py-2 text-sm text-muted-foreground transition-colors hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700"
            >
              <Plus className="size-4" />
              학습 기능 추가
            </button>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              {page.studyRecords.length > 0
                ? `보관 중인 학습 기록 ${page.studyRecords.length}개가 있어요. 다시 켜면 그대로 사용할 수 있어요.`
                : "본문은 그대로 두고 학습 상태 · 이해도 · 태그 · 학습 기록 · AI 학습 도구만 추가해요."}
            </p>
          </div>
        )}

        {(sections.studyHistory || sections.aiTools) && (
          <>
            <hr className="mb-8 mt-16 border-border" />
            <div className="flex flex-col gap-12">
              {sections.studyHistory && (
                <StudyHistory
                  pageId={page.id}
                  records={page.studyRecords}
                  onAdd={handleAddRecord}
                  onUpdate={handleUpdateRecord}
                  onDelete={handleDeleteRecord}
                />
              )}
              {sections.aiTools && <AiToolsSection />}
            </div>
          </>
        )}
      </article>
    </div>
  )
}

function StudyToggle({ checked, onChange }: { checked: boolean; onChange: (next: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="inline-flex items-center gap-2 rounded px-1.5 py-1 transition-colors hover:bg-muted hover:text-foreground"
    >
      학습 기능
      <span
        className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors ${
          checked ? "bg-indigo-600" : "bg-border"
        }`}
      >
        <span
          className={`size-3 rounded-full bg-background shadow-sm transition-transform ${
            checked ? "translate-x-3.5" : "translate-x-0.5"
          }`}
        />
      </span>
      <span className="sr-only">{checked ? "끄기" : "켜기"}</span>
    </button>
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
