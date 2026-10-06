import type { ComponentType } from "react"
import { FilePlus, FileText, GraduationCap, NotebookPen, type LucideIcon } from "lucide-react"
import { newBlockId, type Block } from "@/lib/study-pages"
import { FreeBody, StudyNoteBody, type PageBodyProps } from "@/components/study-page/page-bodies"

// Two independent axes describe a page type:
// - studyMode: whether study features (속성 패널 · 학습 기록 · AI 학습 도구) can be turned off.
//   "locked-on" → always on and tracked; "optional" → the user toggles it per page.
// - bodyTemplate: how the page body is rendered.
export type StudyMode = "locked-on" | "optional"

export interface PageTemplate {
  id: string
  name: string
  // Short copy on the "+ 새 페이지" type cards.
  tagline: string
  // Icon on the "+ 새 페이지" type card.
  cardIcon: LucideIcon
  // Icon in the sidebar page tree.
  treeIcon: LucideIcon
  bodyTemplate: ComponentType<PageBodyProps>
  studyMode: StudyMode
  createBlocks: () => Block[]
}

// Add a template (강의 노트, 시험 대비 ...) by appending to this array; the new-page cards follow automatically.
export const templateRegistry = [
  {
    id: "study-note",
    name: "학습 노트",
    tagline: "진도와 이해도를 체계적으로 관리하고 싶을 때",
    cardIcon: NotebookPen,
    treeIcon: GraduationCap,
    bodyTemplate: StudyNoteBody,
    studyMode: "locked-on",
    createBlocks: () => [
      { id: newBlockId(), type: "h2", text: "오늘 배운 내용" },
      { id: newBlockId(), type: "p", text: "" },
      { id: newBlockId(), type: "h2", text: "핵심 개념" },
      { id: newBlockId(), type: "p", text: "" },
      { id: newBlockId(), type: "h2", text: "헷갈린 점" },
      { id: newBlockId(), type: "p", text: "" },
    ],
  },
  {
    id: "blank",
    name: "빈 페이지",
    tagline: "자유롭게 기록하다가, 필요하면 학습 기능만 살짝 추가",
    cardIcon: FilePlus,
    treeIcon: FileText,
    bodyTemplate: FreeBody,
    studyMode: "optional",
    createBlocks: () => [{ id: newBlockId(), type: "p", text: "" }],
  },
] as const satisfies readonly PageTemplate[]

export type TemplateId = (typeof templateRegistry)[number]["id"]

export const defaultTemplateId: TemplateId = templateRegistry[0].id

export function getTemplate(id: TemplateId): PageTemplate {
  return templateRegistry.find((t) => t.id === id) ?? templateRegistry[0]
}

type PageLike = {
  templateId: TemplateId
  studyEnabled?: boolean
  studyRecords: unknown[]
}

export function isLockedOn(page: Pick<PageLike, "templateId">) {
  return getTemplate(page.templateId).studyMode === "locked-on"
}

export function isStudyOn(page: PageLike) {
  if (isLockedOn(page)) return true
  // Older pages saved before the flag existed: show their records rather than hide them.
  if (page.studyEnabled === undefined) return page.studyRecords.length > 0
  return page.studyEnabled
}

export interface PageLayout {
  Body: ComponentType<PageBodyProps>
  studyOn: boolean
  // "locked": study is always on (menu shows a notice), "toggle": the user can turn it off.
  studyControl: "locked" | "toggle"
}

// What a page renders comes only from its template definition plus its own study flag.
// Every page with study on gets the same 속성 패널 + 학습 기록 + AI 학습 도구.
export function resolvePageLayout(page: PageLike): PageLayout {
  const template = getTemplate(page.templateId)
  return {
    Body: template.bodyTemplate,
    studyOn: isStudyOn(page),
    studyControl: template.studyMode === "locked-on" ? "locked" : "toggle",
  }
}

export interface TreeAppearance {
  icon: LucideIcon
  // An optional-study page that is collecting study records.
  studyBadge: boolean
}

export function resolveTreeAppearance(page: PageLike): TreeAppearance {
  const template = getTemplate(page.templateId)
  return { icon: template.treeIcon, studyBadge: template.studyMode === "optional" && isStudyOn(page) }
}

// Home's 우선 학습 / 복습 widgets and the session timer only consider locked-on pages.
// Optional pages with study on still count toward cumulative analytics.
export const isReviewCandidate = isLockedOn
