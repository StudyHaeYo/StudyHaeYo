"use client"

import { NotebookPen } from "lucide-react"
import type { Block } from "@/lib/study-pages"
import { BlockEditor } from "@/components/study-page/block-editor"

export interface PageBodyProps {
  blocks: Block[]
  onChange: (blocks: Block[]) => void
}

// Guiding questions shown under each 학습 노트 section while it is still empty.
const studyNoteHints: Record<string, string> = {
  "오늘 배운 내용": "오늘 공부한 범위를 한두 문장으로 요약해보세요",
  "핵심 개념": "이 챕터에서 가장 중요한 개념 1~2개를 정의해보세요",
  "헷갈린 점": "아직 확실하지 않은 부분이나 다시 확인할 질문을 적어보세요",
}

export function StudyNoteBody({ blocks, onChange }: PageBodyProps) {
  return (
    <section aria-labelledby="study-note-body-heading" className="rounded-xl border border-indigo-100 bg-indigo-50/30">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-indigo-100 px-5 py-3">
        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-indigo-700">
          <NotebookPen className="size-4" aria-hidden="true" />
          <span id="study-note-body-heading">학습 노트</span>
        </span>
        <span className="text-xs text-muted-foreground">오늘 배운 내용 · 핵심 개념 · 헷갈린 점</span>
      </div>
      <div className="min-h-64 px-5 py-4">
        <BlockEditor blocks={blocks} onChange={onChange} sectionHints={studyNoteHints} />
      </div>
    </section>
  )
}

export function FreeBody({ blocks, onChange }: PageBodyProps) {
  return (
    <div className="min-h-64">
      <BlockEditor blocks={blocks} onChange={onChange} />
    </div>
  )
}
