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
    description: "학습을 바로 시작할 수 있도록 구성된 페이지예요. 오늘 배운 내용 · 핵심 개념 · 헷갈린 점 본문과 학습 속성 · 학습 기록 · AI 학습 도구가 함께 제공돼요.",
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
    description: "원하는 내용을 자유롭게 작성하는 페이지예요. 본문 틀 없이 시작하고, 학습 기능은 필요할 때 켜고 끌 수 있어요.",
    icon: FilePlus,
    sections: { properties: false, studyHistory: false, aiTools: false },
    createBlocks: () => [{ id: newBlockId(), type: "p", text: "" }],
  },
}

type StudyToggleTarget = {
  templateId: TemplateId
  studyEnabled?: boolean
  studyRecords: unknown[]
}

// Templates whose sections are on are dedicated study pages; the others let the user turn study features on/off.
export function canToggleStudy(page: StudyToggleTarget) {
  const { sections } = templates[page.templateId]
  return !(sections.properties || sections.studyHistory)
}

export function hasStudyFeatures(page: StudyToggleTarget) {
  if (!canToggleStudy(page)) return true
  // Older pages saved before the flag existed: show their records rather than hide them.
  if (page.studyEnabled === undefined) return page.studyRecords.length > 0
  return page.studyEnabled
}

export const templateList = [templates["study-note"], templates.blank]
