"use client"

import { Fragment, useState } from "react"
import Link from "next/link"
import { Check, ChevronRight, FileQuestion, NotebookPen, Save } from "lucide-react"
import { computePageStats, type PageStudyRecord } from "@/lib/study-pages"
import { templates } from "@/lib/templates"
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

  const template = templates[page.templateId]
  const path = nodePath({ groups, pages }, page.parentId)
  const subject = nearestSubject({ groups, pages }, page.parentId)
  const stats = computePageStats(page, today)

  const handleSave = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  const handleAddRecord = (record: PageStudyRecord) => {
    updatePage(page.id, (p) => ({ ...p, studyRecords: [...p.studyRecords, record] }))
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

        {template.sections.properties ? (
          <div className="mt-4">
            <PageProperties
              subjectName={subject?.name ?? path.at(-1)?.name ?? "내 페이지"}
              stats={stats}
              recordCount={page.studyRecords.length}
              tags={page.tags}
              onChangeTags={(tags) => updatePage(page.id, (p) => ({ ...p, tags }))}
            />
          </div>
        ) : (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-border bg-card/50 px-4 py-3">
            <p className="text-sm text-muted-foreground">
              {template.label}예요. 학습 노트 템플릿을 적용하면 페이지 속성과 학습 기록을 쓸 수 있어요.
            </p>
            <button
              type="button"
              onClick={() => updatePage(page.id, (p) => ({ ...p, templateId: "study-note" }))}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:border-indigo-300 hover:text-indigo-700"
            >
              <NotebookPen className="size-4" />
              학습 노트 템플릿 적용
            </button>
          </div>
        )}

        <hr className="my-6 border-border" />

        <div className="min-h-64">
          <BlockEditor
            blocks={page.blocks}
            onChange={(blocks) => updatePage(page.id, (p) => ({ ...p, blocks }))}
          />
        </div>

        {(template.sections.studyHistory || template.sections.aiTools) && (
          <>
            <hr className="mb-8 mt-16 border-border" />
            <div className="flex flex-col gap-12">
              {template.sections.studyHistory && (
                <StudyHistory pageId={page.id} records={page.studyRecords} onAdd={handleAddRecord} />
              )}
              {template.sections.aiTools && <AiToolsSection />}
            </div>
          </>
        )}
      </article>
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
