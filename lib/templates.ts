import { ClipboardCheck, FilePlus, FileText, GraduationCap, Presentation, XCircle, type LucideIcon } from "lucide-react"
import { newBlockId, pageKind, type Block, type BlockType, type PageKind } from "@/lib/study-pages"

// Every page is one block body (D-23) and every page can hold study records (D-30: study features are no longer
// turned on or off). A template (노트 종류) decides what the note starts with and what it is for (props.kind).
//
// `templateId` is what the DB stores (workspace_nodes.template_id). It stays "study-note" | "blank":
// 강의 · 오답 · 시험 save as "study-note" with props.kind, so no DB change is needed and an older build can still
// open every page. A "study-note" page with no kind (a 학습 노트 from before D-33) is a 빈 노트.
export const templateRegistry = [
  { id: "study-note", treeIcon: GraduationCap },
  { id: "blank", treeIcon: FileText },
] as const satisfies readonly { id: string; treeIcon: LucideIcon }[]

export type TemplateId = (typeof templateRegistry)[number]["id"]

export function getTemplate(id: TemplateId) {
  return templateRegistry.find((t) => t.id === id) ?? templateRegistry[0]
}

const t = (type: BlockType, text = ""): Block => ({ id: newBlockId(), type, text })

// What each kind starts with: the buttons on an empty note, the kind chip on an empty note, and 기록 → 새 노트.
// [AI로 채우기] is a button, not a starter (D-26).
export interface PageStarter {
  id: string
  name: string
  tagline: string
  icon: LucideIcon
  templateId: TemplateId
  createBlocks: () => Block[]
  // What the page is for (D-27), saved in props.kind once the props column exists.
  kind?: PageKind
}

export const pageStarters: PageStarter[] = [
  {
    id: "blank",
    name: "빈 노트",
    tagline: "아무것도 없는 노트. / 로 원하는 블록을 넣어요",
    icon: FilePlus,
    templateId: "blank",
    createBlocks: () => [t("p")],
  },
  {
    id: "lecture",
    kind: "lecture",
    name: "강의 노트",
    tagline: "수업 들으면서 필기하고, 끝나고 핵심만 추리기",
    icon: Presentation,
    templateId: "study-note",
    createBlocks: () => [
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
    // The first problem starts empty with a hint, not the text "문제 1": people typed under it without deleting it,
    // so their problem landed in the 풀이 and "문제 1" counted as a wrong problem. Why it was wrong goes in each
    // problem's 풀이 (a separate "왜 틀렸나" section lost which problem it was about).
    createBlocks: () => [
      t("h2", "틀린 문제"),
      { id: newBlockId(), type: "toggle", text: "", body: "", open: true },
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
    // 시험일 · 범위는 props에 두고 본문 맨 위에서 고친다(D-27, D-30). 본문은 시험 직전에 볼 것만.
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

// A faint hint on the empty line right under a template heading, so the note shows where to write without text
// to delete first. Typing on the line hides it.
export const starterSectionHints: Record<string, string> = {
  필기: "수업을 들으며 적어요",
  "시험 직전 체크": "시험 전에 확인할 것",
}

export function getStarter(id: string) {
  return pageStarters.find((s) => s.id === id) ?? pageStarters[0]
}

// 노트 종류 (D-30, D-33): one list for the new-note picker, the kind chip in the top bar, the sidebar and search.
// Each kind has something a 빈 노트 doesn't; 학습 노트 had nothing of its own, so it became the 빈 노트.
// "does" says what the kind is for, in the user's words; only what the app does today.
export interface NoteKindOption {
  kind: PageKind | null
  starterId: string
  name: string
  does: string
  icon: LucideIcon
}

export const noteKinds: NoteKindOption[] = [
  { kind: "lecture", starterId: "lecture", name: "강의 노트", does: "강의 PDF를 옆에 펴고 필기해요", icon: Presentation },
  { kind: "wrong-answers", starterId: "wrong-answers", name: "오답 노트", does: "틀린 문제만 다시 풀어요", icon: XCircle },
  { kind: "exam", starterId: "exam", name: "시험 정리", does: "시험일까지 범위를 챙겨요", icon: ClipboardCheck },
  { kind: null, starterId: "blank", name: "빈 노트", does: "모양 없이 자유롭게 써요", icon: FileText },
]

export function noteKindOption(kind: PageKind | null) {
  return noteKinds.find((k) => k.kind === kind) ?? noteKinds[noteKinds.length - 1]
}

// The icon a note shows in the sidebar, lists and the kind chip.
export function noteIcon(page: Parameters<typeof pageKind>[0]): LucideIcon {
  return noteKindOption(pageKind(page)).icon
}
