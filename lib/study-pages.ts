import { reviewOffsetDays } from "@/lib/learning-os"
import type { StudyType } from "@/lib/types"
import type { TemplateId } from "@/lib/templates"

export type BlockType = "h1" | "h2" | "h3" | "p" | "li" | "code"
export type AttachmentBlockType = "image" | "file"

export interface TextBlock {
  id: string
  type: BlockType
  text: string
}

// "image" is used only for formats the browser previews inline; every other file is a "file" card.
export interface AttachmentBlock {
  id: string
  type: AttachmentBlockType
  name: string
  mime: string
  size: number
  url: string
}

export type DrawingTool = "pen" | "highlighter"
// [x, y] as fractions of the block width (y too), so the drawing keeps its shape at any width.
export type DrawingPoint = [number, number]

export interface DrawingStroke {
  tool: DrawingTool
  color: string
  // Screen pixels; strokes keep their thickness when the block is resized.
  width: number
  points: DrawingPoint[]
}

export interface DrawingBlock {
  id: string
  type: "drawing"
  strokes: DrawingStroke[]
  // Pixels. Grows with "아래로 늘리기".
  height: number
}

export type Block = TextBlock | AttachmentBlock | DrawingBlock

export function isTextBlock(block: Block): block is TextBlock {
  return block.type !== "image" && block.type !== "file" && block.type !== "drawing"
}

export function isDrawingBlock(block: Block): block is DrawingBlock {
  return block.type === "drawing"
}

// Copies nested stroke data too, so editing a duplicated page never touches the original.
export function cloneBlock(block: Block): Block {
  if (!isDrawingBlock(block)) return { ...block }
  return {
    ...block,
    strokes: block.strokes.map((s) => ({ ...s, points: s.points.map(([x, y]): DrawingPoint => [x, y]) })),
  }
}

// Plain text of the body for text-only consumers (AI tools, search); attachments and drawings are skipped.
export function blocksPlainText(blocks: Block[]) {
  return blocks
    .filter(isTextBlock)
    .map((b) => b.text)
    .join("\n")
}

export interface NoteConcept {
  id: string
  text: string
}

export interface NoteConfusion {
  id: string
  text: string
  resolved: boolean
}

// Structured body of the 학습 노트 template. Free-form pages keep using `blocks`.
export interface StudyNoteContent {
  learned: Block[]
  concepts: NoteConcept[]
  confusions: NoteConfusion[]
}

export interface PageStudyRecord {
  id: string
  pageId: string
  date: string
  // Creation time (ms); lets analytics tell which timer session a record belongs to. Kept on edit.
  createdAt?: number
  durationMinutes: number
  understanding: number
  // What was actually done in this session (activity log), distinct from the page body's "오늘 배운 내용".
  studyContent: string
  difficulties: string
  nextSteps: string
  tags: string[]
}

// Every page (seeded or user-created) uses this one shape.
export interface StudyPage {
  id: string
  title: string
  // Id of the containing workspace group (folder or subject); null means the workspace root.
  parentId: string | null
  templateId: TemplateId
  createdAt: string
  studyType?: StudyType
  // Body for block-schema templates (빈 페이지).
  blocks: Block[]
  // Body for structured-note templates (학습 노트).
  note?: StudyNoteContent
  tags: string[]
  studyRecords: PageStudyRecord[]
  // Values the user picked directly on the page. When unset, they are derived from the latest study record.
  status?: PageStatus
  understanding?: number
  // Set when the user turns on study features for a page whose template doesn't include them (e.g. 빈 페이지).
  studyEnabled?: boolean
}

export const pageStatuses = ["시작 전", "학습 중", "복습 필요", "완료"] as const
export type PageStatus = (typeof pageStatuses)[number]

export interface PageStats {
  status: PageStatus
  understanding: number | null
  totalDurationMinutes: number
  lastStudiedAt: string | null
  nextReviewAt: string | null
  statusIsManual: boolean
  understandingIsManual: boolean
}

export function toISODate(date: Date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

export function todayISO() {
  return toISODate(new Date())
}

export function addDays(iso: string, days: number) {
  const [y, m, d] = iso.split("-").map(Number)
  const date = new Date(y, m - 1, d)
  date.setDate(date.getDate() + days)
  return toISODate(date)
}

// Same date: newer createdAt first. Record ids are random uuids, so they only break exact ties.
export function sortRecordsNewestFirst(records: PageStudyRecord[]) {
  return [...records].sort(
    (a, b) =>
      b.date.localeCompare(a.date) || (b.createdAt ?? 0) - (a.createdAt ?? 0) || b.id.localeCompare(a.id),
  )
}

// Review spacing (reviewOffsetDays): the next review day after studying on `date` with this understanding.
export function nextReviewDate(date: string, understanding: number) {
  return addDays(date, reviewOffsetDays[understanding] ?? 4)
}

// Study record ids are uuids (study_records.id).
export function newRecordId() {
  return crypto.randomUUID()
}

// `today` is null during SSR/hydration (see useTodayISO); the review check waits for the browser date.
export function computePageStats(page: StudyPage, today: string | null): PageStats {
  const records = sortRecordsNewestFirst(page.studyRecords)
  const latest = records[0]
  const understanding = page.understanding ?? latest?.understanding ?? null
  const nextReviewAt = latest ? nextReviewDate(latest.date, understanding ?? latest.understanding) : null

  let derivedStatus: PageStatus = "시작 전"
  if (latest) {
    derivedStatus = today && nextReviewAt && nextReviewAt <= today ? "복습 필요" : understanding === 5 ? "완료" : "학습 중"
  }

  return {
    status: page.status ?? derivedStatus,
    understanding,
    totalDurationMinutes: records.reduce((sum, r) => sum + r.durationMinutes, 0),
    lastStudiedAt: latest?.date ?? null,
    nextReviewAt,
    statusIsManual: page.status !== undefined,
    understandingIsManual: page.understanding !== undefined,
  }
}

// Study notes saved before the structured body existed keep their blocks as "오늘 배운 내용".
export function noteOf(page: Pick<StudyPage, "note" | "blocks">): StudyNoteContent {
  return page.note ?? { learned: page.blocks, concepts: [], confusions: [] }
}

export function unresolvedConfusionCount(page: Pick<StudyPage, "note">) {
  return page.note?.confusions.filter((c) => !c.resolved).length ?? 0
}

// "용어: 설명" → front "용어", back "설명". Without a separator the whole text is the back of the card.
export function splitConcept(text: string): { term: string | null; detail: string } {
  const match = text.match(/^\s*([^:：\n]{1,40})[:：]\s*([\s\S]+)$/)
  return match ? { term: match[1].trim(), detail: match[2].trim() } : { term: null, detail: text.trim() }
}

export function formatDuration(minutes: number) {
  if (minutes <= 0) return "0분"
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}분`
  return m === 0 ? `${h}시간` : `${h}시간 ${m}분`
}

// One date style across the app: "9월 28일". Lists that track a deadline add a relative label (dueLabel).
export function formatDate(iso: string) {
  const [, m, d] = iso.split("-").map(Number)
  return `${m}월 ${d}일`
}

// Whole days from `fromISO` to `toISO` (local date strings, no time zone).
export function daysBetween(fromISO: string, toISO: string) {
  const [fy, fm, fd] = fromISO.split("-").map(Number)
  const [ty, tm, td] = toISO.split("-").map(Number)
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86_400_000)
}

export type DueTone = "overdue" | "today" | "soon" | "later"

// How a review date reads next to today: "3일 지남", "오늘", "내일", "5일 후".
export function dueLabel(dueISO: string, today: string): { label: string; tone: DueTone } {
  const diff = daysBetween(today, dueISO)
  if (diff < 0) return { label: `${-diff}일 지남`, tone: "overdue" }
  if (diff === 0) return { label: "오늘", tone: "today" }
  if (diff === 1) return { label: "내일", tone: "soon" }
  return { label: `${diff}일 후`, tone: "later" }
}

export const dueToneClass: Record<DueTone, string> = {
  overdue: "text-red-600",
  today: "text-amber-600",
  soon: "text-indigo-600",
  later: "text-muted-foreground",
}

let blockSeq = 0
export function newBlockId() {
  blockSeq += 1
  return `b-${Date.now().toString(36)}-${blockSeq}`
}

export function newItemId(prefix: "c" | "q") {
  blockSeq += 1
  return `${prefix}-${Date.now().toString(36)}-${blockSeq}`
}

const b = (id: string, type: BlockType, text: string): Block => ({ id, type, text })

function seedNote(prefix: string, learned: Block[], concepts: string[], confusions: [string, boolean][]): StudyNoteContent {
  return {
    learned,
    concepts: concepts.map((text, i) => ({ id: `${prefix}-c${i + 1}`, text })),
    confusions: confusions.map(([text, resolved], i) => ({ id: `${prefix}-q${i + 1}`, text, resolved })),
  }
}

// Seed pages: initial data created from the 학습 노트 template, not a separate kind of page.
export const studyPages: StudyPage[] = [
  {
    id: "ds-1",
    title: "해시테이블 정리",
    parentId: "ds",
    templateId: "study-note",
    createdAt: "2026-09-25",
    studyType: "정리",
    tags: ["자료구조", "해시", "알고리즘"],
    blocks: [],
    note: seedNote(
      "ds1",
      [
        b("ds1-1", "p", "해시 테이블은 키와 값을 저장하는 자료구조이다. 해시 함수로 키를 배열 인덱스로 바꿔 평균 O(1)에 탐색할 수 있다."),
        b("ds1-2", "h3", "충돌 처리"),
        b("ds1-3", "p", "서로 다른 키가 같은 인덱스로 변환되는 것을 충돌이라고 한다."),
        b("ds1-7", "li", "선형 탐사: 다음 칸을 순서대로 확인"),
        b("ds1-8", "li", "이차 탐사: 1², 2², 3² 간격으로 확인"),
        b("ds1-9", "li", "이중 해싱: 두 번째 해시 함수로 이동 간격 결정"),
        b("ds1-11", "code", "const index = hash(key) % table.length\ntable[index] = value"),
      ],
      [
        "해시 함수: 키를 배열 인덱스로 바꾸는 함수. 같은 키는 항상 같은 인덱스가 나와야 한다.",
        "Chaining: 같은 인덱스에 연결 리스트를 두고 값을 이어서 저장한다. 구현이 단순하지만 추가 메모리가 필요하다.",
        "Open Addressing: 충돌이 나면 테이블 안의 다른 빈 칸을 찾아 저장한다.",
        "로드 팩터: 저장된 개수 / 테이블 크기. 보통 0.75를 넘으면 테이블을 두 배로 늘리고 리해싱한다.",
      ],
      [
        ["해시 함수가 인덱스를 만드는 과정", true],
        ["Open Addressing에서 값을 삭제하면 탐사가 끊기는 문제", false],
      ],
    ),
    studyRecords: [
      { id: "ds1-r1", pageId: "ds-1", date: "2026-09-25", durationMinutes: 40, understanding: 2, studyContent: "강의 영상으로 해시 함수와 해시 테이블의 기본 구조를 공부함", difficulties: "해시 함수가 인덱스를 만드는 과정", nextSteps: "체이닝 직접 구현해보기", tags: ["해시"] },
      { id: "ds1-r2", pageId: "ds-1", date: "2026-09-27", durationMinutes: 50, understanding: 3, studyContent: "체이닝을 직접 구현하고 Open Addressing 개념을 읽음", difficulties: "Open Addressing의 탐색 과정", nextSteps: "탐사 방식별 차이 정리", tags: ["해시"] },
      { id: "ds1-r3", pageId: "ds-1", date: "2026-09-28", durationMinutes: 60, understanding: 4, studyContent: "선형·이차 탐사, 이중 해싱을 비교 정리하고 로드 팩터 예제를 풀어봄", difficulties: "Open Addressing의 충돌 처리 방식", nextSteps: "충돌 처리 방법 다시 복습하기", tags: ["해시", "충돌"] },
    ],
  },
  {
    id: "ds-2",
    title: "정렬 알고리즘 복습",
    parentId: "ds",
    templateId: "study-note",
    createdAt: "2026-09-24",
    studyType: "복습",
    tags: ["자료구조", "정렬"],
    blocks: [],
    note: seedNote(
      "ds2",
      [b("ds2-1", "p", "비교 기반 정렬 세 가지(퀵·병합·힙)의 동작 과정과 시간 복잡도를 손으로 따라가며 다시 정리했다.")],
      [
        "퀵 정렬: 피벗을 기준으로 작은 값과 큰 값을 나눈다. 평균 O(n log n), 최악 O(n²).",
        "병합 정렬: 반으로 나눈 뒤 합치면서 정렬한다. 항상 O(n log n)이지만 추가 메모리가 필요하다.",
        "힙 정렬: 최대 힙을 만든 뒤 루트를 끝으로 보내며 정렬한다. 제자리 정렬이지만 불안정 정렬이다.",
      ],
      [["heapify에서 자식 인덱스(2i+1, 2i+2) 계산", false]],
    ),
    studyRecords: [
      { id: "ds2-r1", pageId: "ds-2", date: "2026-09-24", durationMinutes: 60, understanding: 3, studyContent: "퀵·병합·힙 정렬의 동작 과정을 손으로 따라가며 복습함", difficulties: "힙 정렬의 heapify 인덱스 계산", nextSteps: "안정 정렬 여부 표로 정리", tags: ["정렬"] },
    ],
  },
  {
    id: "ds-3",
    title: "트리 순회 강의 노트",
    parentId: "ds",
    templateId: "study-note",
    createdAt: "2026-09-21",
    studyType: "강의",
    tags: ["자료구조", "트리"],
    blocks: [],
    note: seedNote(
      "ds3",
      [b("ds3-1", "p", "이진 트리를 방문하는 세 가지 방법을 강의로 듣고 재귀 코드로 작성했다.")],
      [
        "전위 순회: 루트 → 왼쪽 → 오른쪽",
        "중위 순회: 왼쪽 → 루트 → 오른쪽",
        "후위 순회: 왼쪽 → 오른쪽 → 루트",
      ],
      [],
    ),
    studyRecords: [
      { id: "ds3-r1", pageId: "ds-3", date: "2026-09-21", durationMinutes: 45, understanding: 5, studyContent: "트리 순회 강의를 듣고 전위·중위·후위 순회를 코드로 작성함", difficulties: "", nextSteps: "레벨 순회(BFS)까지 확장", tags: ["트리"] },
    ],
  },
  {
    id: "os-1",
    title: "프로세스 스레드 차이",
    parentId: "os",
    templateId: "study-note",
    createdAt: "2026-09-25",
    studyType: "정리",
    tags: ["운영체제", "프로세스"],
    blocks: [],
    note: seedNote(
      "os1",
      [b("os1-1", "p", "교재 3장을 읽고 프로세스와 스레드가 메모리를 어떻게 나눠 쓰는지 정리했다.")],
      [
        "프로세스: 실행 중인 프로그램. 독립된 메모리 공간(코드, 데이터, 힙, 스택)을 가진다.",
        "스레드: 프로세스 안의 실행 흐름. 스택만 따로 갖고 코드, 데이터, 힙은 공유한다.",
        "컨텍스트 스위칭: 스레드 전환은 메모리 공간을 바꾸지 않아 프로세스 전환보다 비용이 적다.",
      ],
      [
        ["스레드가 공유하는 영역과 공유하지 않는 영역", false],
        ["멀티프로세스와 멀티스레드의 장단점 비교", false],
      ],
    ),
    studyRecords: [
      { id: "os1-r1", pageId: "os-1", date: "2026-09-26", durationMinutes: 35, understanding: 2, studyContent: "교재 3장을 읽고 프로세스와 스레드의 차이를 정리함", difficulties: "스레드가 공유하는 영역과 공유하지 않는 영역", nextSteps: "메모리 구조 그림으로 다시 그려보기", tags: ["프로세스"] },
    ],
  },
  {
    id: "eng-1",
    title: "실기 기출 3회분",
    parentId: "engineer",
    templateId: "study-note",
    createdAt: "2026-09-23",
    studyType: "문제풀이",
    tags: ["정보처리기사", "기출"],
    blocks: [],
    note: seedNote(
      "eng1",
      [
        b("eng1-1", "p", "실기 기출 3회분을 풀고 오답을 정리했다."),
        b("eng1-4", "code", "SELECT dept, COUNT(*)\nFROM emp\nGROUP BY dept\nHAVING COUNT(*) > 3;"),
      ],
      [
        "HAVING: GROUP BY로 묶은 결과에 조건을 거는 절. WHERE는 그룹화 전에 적용된다.",
        "3NF: 2NF를 만족하고 이행적 함수 종속을 제거한 상태.",
        "BCNF: 모든 결정자가 후보키인 상태. 3NF보다 엄격하다.",
      ],
      [
        ["GROUP BY와 HAVING의 실행 순서", true],
        ["3NF와 BCNF의 차이", false],
        ["정규화 단계 구분", false],
      ],
    ),
    studyRecords: [
      { id: "eng1-r1", pageId: "eng-1", date: "2026-09-23", durationMinutes: 90, understanding: 2, studyContent: "실기 기출 1회분을 시간 재고 풀고 채점함", difficulties: "SQL 집계 함수 문제", nextSteps: "SQL 파트 오답 다시 풀기", tags: ["SQL"] },
      { id: "eng1-r2", pageId: "eng-1", date: "2026-09-25", durationMinutes: 80, understanding: 3, studyContent: "기출 2회분을 풀고 SQL 오답을 다시 풀어봄", difficulties: "정규화 단계 구분", nextSteps: "BCNF 예제 3개 풀기", tags: ["정규화"] },
    ],
  },
]
