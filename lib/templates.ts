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
    description: "바로 학습을 시작할 수 있어요. 오늘 배운 내용 · 핵심 개념 · 헷갈린 점 틀과 학습 기능이 기본 제공돼요.",
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
    description: "아무것도 정해지지 않은 빈 화면에서 자유롭게 시작해요. 학습 기능은 필요할 때 추가할 수 있어요.",
    icon: FilePlus,
    sections: { properties: false, studyHistory: false, aiTools: false },
    createBlocks: () => [{ id: newBlockId(), type: "p", text: "" }],
  },
}

export function hasStudyFeatures(page: {
  templateId: TemplateId
  studyEnabled?: boolean
  studyRecords: unknown[]
}) {
  const { sections } = templates[page.templateId]
  // Pages that already have records keep showing them even if their template has study features off.
  return page.studyEnabled === true || page.studyRecords.length > 0 || sections.properties || sections.studyHistory
}

export const templateList = [templates["study-note"], templates.blank]
