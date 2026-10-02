import { FilePlus, NotebookPen, type LucideIcon } from "lucide-react"
import { newBlockId, type Block } from "@/lib/study-pages"

// Add new templates (강의 노트, 시험 대비, 독서 기록 ...) by extending this union and the map below.
export type TemplateId = "blank" | "study-note"

export interface PageTemplate {
  id: TemplateId
  label: string
  description: string
  icon: LucideIcon
  sections: {
    properties: boolean
    studyHistory: boolean
    aiTools: boolean
  }
  createBlocks: () => Block[]
}

export const templates: Record<TemplateId, PageTemplate> = {
  "study-note": {
    id: "study-note",
    label: "학습 노트",
    description: "오늘 배운 내용 · 핵심 개념 · 헷갈린 점 본문 틀이 미리 채워져서 시작해요.",
    icon: NotebookPen,
    sections: { properties: true, studyHistory: true, aiTools: true },
    createBlocks: () => [
      { id: newBlockId(), type: "h2", text: "오늘 배운 내용" },
      { id: newBlockId(), type: "p", text: "" },
      { id: newBlockId(), type: "h2", text: "핵심 개념" },
      { id: newBlockId(), type: "p", text: "" },
      { id: newBlockId(), type: "h2", text: "헷갈린 점" },
      { id: newBlockId(), type: "p", text: "" },
    ],
  },
  blank: {
    id: "blank",
    label: "빈 페이지",
    description: "본문 틀 없이 빈 화면에서 자유롭게 작성해요. 학습 상태·학습 기록·AI 도구는 똑같이 쓸 수 있어요.",
    icon: FilePlus,
    sections: { properties: true, studyHistory: true, aiTools: true },
    createBlocks: () => [{ id: newBlockId(), type: "p", text: "" }],
  },
}

export const templateList = [templates["study-note"], templates.blank]
