import { FilePlus, FileText, GraduationCap, NotebookPen, type LucideIcon } from "lucide-react"
import { newBlockId, type Block } from "@/lib/study-pages"

// Add new templates (강의 노트, 시험 대비, 독서 기록 ...) by extending this union and the map below.
export type TemplateId = "blank" | "study-note"

// How a page type behaves as a study page:
// - "built-in": the page itself is one study target — study features are always on and can't be turned off.
// - "optional": a free page — study features are opt-in and attach only at the bottom.
export type StudyMode = "built-in" | "optional"

export interface PageTemplate {
  id: TemplateId
  label: string
  description: string
  // Short copy on the "+ 새 페이지" type cards.
  tagline: string
  icon: LucideIcon
  // Icon in the sidebar page tree.
  treeIcon: LucideIcon
  studyMode: StudyMode
  layout: {
    // Top study properties (과목 · 상태 · 이해도 · 시간 · 마지막/다음 학습 · 태그).
    propertiesPanel: boolean
    body: "study-note" | "free"
  }
  createBlocks: () => Block[]
}

export const templates: Record<TemplateId, PageTemplate> = {
  "study-note": {
    id: "study-note",
    label: "학습 노트",
    description: "학습을 바로 시작할 수 있도록 구성된 페이지예요. 오늘 배운 내용 · 핵심 개념 · 헷갈린 점 본문과 학습 속성 · 학습 기록 · AI 학습 도구가 함께 제공돼요.",
    tagline: "진도와 이해도를 체계적으로 관리하고 싶을 때",
    icon: NotebookPen,
    treeIcon: GraduationCap,
    studyMode: "built-in",
    layout: { propertiesPanel: true, body: "study-note" },
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
    tagline: "자유롭게 기록하다가, 필요하면 학습 기능만 살짝 추가",
    icon: FilePlus,
    treeIcon: FileText,
    studyMode: "optional",
    layout: { propertiesPanel: false, body: "free" },
    createBlocks: () => [{ id: newBlockId(), type: "p", text: "" }],
  },
}

type LayoutTarget = {
  templateId: TemplateId
  studyEnabled?: boolean
  studyRecords: unknown[]
}

export interface PageLayout {
  propertiesPanel: boolean
  body: "study-note" | "free"
  // "tools": 학습 기록 + AI 학습 도구, "offer": 학습 기능 추가 card.
  bottom: "tools" | "offer"
  canDisableStudy: boolean
}

// Study-note pages are the only candidates for Home's 우선 학습 / 복습 widgets.
// Free pages with study turned on still count toward cumulative analytics.
export function isStudyNotePage(page: Pick<LayoutTarget, "templateId">) {
  return templates[page.templateId].studyMode === "built-in"
}

export interface TreeAppearance {
  icon: LucideIcon
  // A free page that is collecting study records.
  studyBadge: boolean
}

export function resolveTreeAppearance(page: LayoutTarget): TreeAppearance {
  const template = templates[page.templateId]
  return { icon: template.treeIcon, studyBadge: template.studyMode === "optional" && isStudyOn(page) }
}

export function isStudyOn(page: LayoutTarget) {
  if (templates[page.templateId].studyMode === "built-in") return true
  // Older pages saved before the flag existed: show their records rather than hide them.
  if (page.studyEnabled === undefined) return page.studyRecords.length > 0
  return page.studyEnabled
}

// Single source of truth for what a page renders: page type (template) + its study state.
export function resolvePageLayout(page: LayoutTarget): PageLayout {
  const { studyMode, layout } = templates[page.templateId]
  const studyOn = isStudyOn(page)
  return {
    // Study properties belong to the study-note type only; enabling study on a free page never adds them.
    propertiesPanel: layout.propertiesPanel,
    body: layout.body,
    bottom: studyOn ? "tools" : "offer",
    canDisableStudy: studyMode === "optional" && studyOn,
  }
}

export const templateList = [templates["study-note"], templates.blank]
