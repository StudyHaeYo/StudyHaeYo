import { ClipboardCheck, FilePlus, FileText, GraduationCap, NotebookPen, Presentation, Sparkles, XCircle, type LucideIcon } from "lucide-react"
import { newBlockId, type Block, type BlockType, type PageKind } from "@/lib/study-pages"

// Every page is one block body (D-23). A template only decides what a new page starts with:
// its first blocks and whether study features (속성 · 학습 기록 · AI 도구) start on.
//
// `templateId` is what the DB stores (workspace_nodes.template_id). It stays "study-note" | "blank":
// study templates all save as "study-note" (study on by default), so no DB change is needed
// and an older build can still open every page.
export const templateRegistry = [
  { id: "study-note", treeIcon: GraduationCap },
  { id: "blank", treeIcon: FileText },
] as const satisfies readonly { id: string; treeIcon: LucideIcon }[]

export type TemplateId = (typeof templateRegistry)[number]["id"]

export function getTemplate(id: TemplateId) {
  return templateRegistry.find((t) => t.id === id) ?? templateRegistry[0]
}

const t = (type: BlockType, text = ""): Block => ({ id: newBlockId(), type, text })

// The cards on "+ 새 페이지". Add a template by appending here.
export interface PageStarter {
  id: string
  name: string
  tagline: string
  icon: LucideIcon
  templateId: TemplateId
  createBlocks: () => Block[]
  // Opens the AI panel on the new page (/record/<id>?ai=1).
  openAi?: boolean
  // What the page is for (D-27), saved in props.kind once the props column exists.
  kind?: PageKind
}

export const pageStarters: PageStarter[] = [
  {
    id: "blank",
    name: "빈 페이지",
    tagline: "아무것도 없는 페이지. / 로 원하는 블록을 넣어요",
    icon: FilePlus,
    templateId: "blank",
    createBlocks: () => [t("p")],
  },
  {
    id: "ai",
    name: "AI로 시작하기",
    tagline: "제목에 주제를 적으면 AI가 정리 노트나 문제를 만들어 줘요",
    icon: Sparkles,
    templateId: "study-note",
    createBlocks: () => [t("p")],
    openAi: true,
  },
  {
    id: "study-note",
    kind: "note",
    name: "학습 노트",
    tagline: "배운 내용 · 핵심 개념 · 헷갈린 점. 핵심 개념은 복습 카드가 돼요",
    icon: NotebookPen,
    templateId: "study-note",
    createBlocks: () => [
      t("h2", "오늘 배운 내용"),
      t("p"),
      t("h2", "핵심 개념"),
      t("concept"),
      t("h2", "헷갈린 점"),
      t("confusion"),
    ],
  },
  {
    id: "lecture",
    kind: "lecture",
    name: "강의 노트",
    tagline: "수업 들으면서 필기하고, 끝나고 핵심만 추리기",
    icon: Presentation,
    templateId: "study-note",
    createBlocks: () => [
      t("callout", "강의 PDF를 이 페이지에 끌어다 놓으면, 속성의 ‘강의 자료’로 골라 옆에 펴 두고 필기할 수 있어요."),
      t("h2", "필기"),
      t("li"),
      t("h2", "핵심 개념"),
      t("concept"),
      t("h2", "질문할 것"),
      t("confusion"),
    ],
  },
  {
    id: "wrong-answers",
    kind: "wrong-answers",
    name: "오답 노트",
    tagline: "틀린 문제와 풀이를 접어 두고 다시 풀어보기",
    icon: XCircle,
    templateId: "study-note",
    createBlocks: () => [
      t("h2", "틀린 문제"),
      { id: newBlockId(), type: "toggle", text: "문제 1", body: "", open: true },
      t("h2", "왜 틀렸나"),
      t("li"),
      t("h2", "핵심 개념"),
      t("concept"),
    ],
  },
  {
    id: "exam",
    kind: "exam",
    name: "시험 정리",
    tagline: "범위를 체크하며 정리하고, 자주 틀리는 것 모아 두기",
    icon: ClipboardCheck,
    templateId: "study-note",
    // 시험일 · 범위는 속성에 둔다(D-27). 본문은 시험 직전에 볼 것만.
    createBlocks: () => [
      t("h2", "꼭 나오는 개념"),
      t("concept"),
      t("h2", "자주 틀리는 것"),
      t("confusion"),
      t("h2", "시험 직전 체크"),
      { id: newBlockId(), type: "todo", text: "", checked: false },
    ],
  },
]

export function getStarter(id: string) {
  return pageStarters.find((s) => s.id === id) ?? pageStarters[0]
}

type PageLike = {
  templateId: TemplateId
  studyEnabled?: boolean
  studyRecords: unknown[]
}

// Study features can be turned on or off on any page. Pages from a study template start on.
export function isStudyOn(page: PageLike) {
  if (page.studyEnabled !== undefined) return page.studyEnabled
  if (page.templateId === "study-note") return true
  // Older blank pages saved before the flag existed: show their records rather than hide them.
  return page.studyRecords.length > 0
}

export interface TreeAppearance {
  icon: LucideIcon
  // A blank page that is collecting study records.
  studyBadge: boolean
}

export function resolveTreeAppearance(page: PageLike): TreeAppearance {
  return { icon: getTemplate(page.templateId).treeIcon, studyBadge: page.templateId === "blank" && isStudyOn(page) }
}

// Home's 복습 widgets, review lists and the session timer: every page with study on
// (a page only gets a review date once it has a record).
export const isReviewCandidate = isStudyOn
