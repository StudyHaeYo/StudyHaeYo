import type { ComponentType } from "react"
import { FilePlus, FileText, GraduationCap, NotebookPen, type LucideIcon } from "lucide-react"
import { newBlockId, type Block, type StudyNoteContent } from "@/lib/study-pages"
import { FreeBody, StudyNoteBody, type PageBodyProps } from "@/components/study-page/page-bodies"
import { StudyNoteReview, type ReviewBodyProps } from "@/components/study-page/study-note-review"

// Initial body for a new page. `note` is only set by structured-note templates.
export interface PageContent {
  blocks: Block[]
  note?: StudyNoteContent
}

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
  // Optional body used when the page is opened with ?mode=review.
  reviewTemplate?: ComponentType<ReviewBodyProps>
  studyMode: StudyMode
  createContent: () => PageContent
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
    reviewTemplate: StudyNoteReview,
    studyMode: "locked-on",
    createContent: () => ({
      blocks: [],
      note: { learned: [{ id: newBlockId(), type: "p", text: "" }], concepts: [], confusions: [] },
    }),
  },
  {
    id: "blank",
    name: "빈 페이지",
    tagline: "자유롭게 기록하다가, 필요하면 학습 기능만 살짝 추가",
    cardIcon: FilePlus,
    treeIcon: FileText,
    bodyTemplate: FreeBody,
    studyMode: "optional",
    createContent: () => ({ blocks: [{ id: newBlockId(), type: "p", text: "" }] }),
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
  // Set only for locked-on templates that define a review body.
  ReviewBody: ComponentType<ReviewBodyProps> | null
  studyOn: boolean
  // "locked": study is always on (menu shows a notice), "toggle": the user can turn it off.
  studyControl: "locked" | "toggle"
}

// What a page renders comes only from its template definition plus its own study flag.
// Every page uses the same single-column frame; with study on it gets 속성 + 학습 기록 + AI 학습 도구.
export function resolvePageLayout(page: PageLike): PageLayout {
  const template = getTemplate(page.templateId)
  const lockedOn = template.studyMode === "locked-on"
  return {
    Body: template.bodyTemplate,
    ReviewBody: lockedOn ? (template.reviewTemplate ?? null) : null,
    studyOn: isStudyOn(page),
    studyControl: lockedOn ? "locked" : "toggle",
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
