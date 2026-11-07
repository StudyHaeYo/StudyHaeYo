import { blocksPlainText, conceptBlocks, isTextBlock, wrongProblems, type Block, type StudyPage } from "@/lib/study-pages"

// 복습 (D-34): reviewing happens in the note itself. The answers are covered where they were written (핵심 개념의
// 설명, a 오답 노트 problem's 풀이, what is under a heading); the user recalls, opens, and marks each. The marks
// set 이해도 by the ladder (D-32) and leave one record.

export type ReviewLevel = "하" | "중" | "상"
export type ReviewItemType = "concept" | "problem" | "heading"
// right = 알았음 / 맞힘, unsure = 헷갈림, wrong = 몰랐음 / 틀림.
export type Judgment = "wrong" | "unsure" | "right"
// What the note is reviewed with: its items, its headings when it has no items, or nothing (the user picks 1–5).
export type ReviewCue = "items" | "headings" | "none"

export interface ReviewItem {
  blockId: string
  type: ReviewItemType
  level: ReviewLevel
  label: string
}

export interface JudgedItem {
  item: ReviewItem
  judgment: Judgment
  // An answer was written before opening. The in-note review has no answer box, so this is false there: written
  // answers come from the AI 창's 확인 문제 (D-32: 4 and 5 only from written answers).
  written: boolean
}

export const reviewHref = (pageId: string) => `/record/${pageId}?mode=review`

const HEADINGS = ["h1", "h2", "h3"]
const MAX_HEADINGS = 10

// A heading with something written under it (up to the next heading). Sections holding only 핵심 개념 · 헷갈린 점
// blocks are not something to recall from a heading.
function headingItems(blocks: Block[]): ReviewItem[] {
  const items: ReviewItem[] = []
  for (let i = 0; i < blocks.length && items.length < MAX_HEADINGS; i++) {
    const b = blocks[i]
    if (!isTextBlock(b) || !HEADINGS.includes(b.type) || !b.text.trim()) continue
    const section: Block[] = []
    for (let j = i + 1; j < blocks.length; j++) {
      const next = blocks[j]
      if (isTextBlock(next) && HEADINGS.includes(next.type)) break
      if (isTextBlock(next) && (next.type === "concept" || next.type === "confusion")) continue
      section.push(next)
    }
    if (blocksPlainText(section).trim()) items.push({ blockId: b.id, type: "heading", level: "중", label: b.text.trim() })
  }
  return items
}

// The blocks a heading item covers: everything under it up to the next heading.
export function sectionUnder(blocks: Block[], headingId: string) {
  const start = blocks.findIndex((b) => b.id === headingId)
  const ids: string[] = []
  if (start < 0) return ids
  for (let j = start + 1; j < blocks.length; j++) {
    const next = blocks[j]
    if (isTextBlock(next) && HEADINGS.includes(next.type)) break
    ids.push(next.id)
  }
  return ids
}

// 핵심 개념 (하) first, then a 오답 노트's problems still wrong (중, 적용 by default). `problems` is off until the note
// can be a 오답 노트 (props column, D-27).
export function reviewItems(page: Pick<StudyPage, "blocks">, problems: boolean): { cue: ReviewCue; items: ReviewItem[] } {
  const concepts: ReviewItem[] = conceptBlocks(page.blocks).map((b) => ({ blockId: b.id, type: "concept", level: "하", label: b.text }))
  const wrong: ReviewItem[] = problems
    ? wrongProblems(page.blocks).map((b) => ({ blockId: b.id, type: "problem", level: "중", label: b.text.trim() }))
    : []
  const items = [...concepts, ...wrong]
  if (items.length > 0) return { cue: "items", items }
  const headings = headingItems(page.blocks)
  return headings.length > 0 ? { cue: "headings", items: headings } : { cue: "none", items: [] }
}

// A level is passed with every item right, or one miss when it has 3 or more (D-32, same as the AI quiz).
function passed(rows: JudgedItem[], ok: (row: JudgedItem) => boolean) {
  const right = rows.filter(ok).length
  return rows.length > 0 && right >= rows.length - (rows.length >= 3 ? 1 : 0)
}

const isRight = (row: JudgedItem) => row.judgment === "right"
const isRightWritten = (row: JudgedItem) => row.judgment === "right" && row.written

// 사다리 (D-32): anything right → 2, the lowest level asked passed → 3, 중 passed with written answers → 4,
// then 상 passed with written answers → 5. Without 하 items the first level asked is the base.
export function reviewUnderstanding(rows: JudgedItem[]) {
  const at = (level: ReviewLevel) => rows.filter((r) => r.item.level === level)
  const low = at("하")
  const mid = at("중")
  const high = at("상")
  const value = rows.some(isRight) ? 2 : 1
  if (!passed(low.length > 0 ? low : [...mid, ...high], isRight)) return value
  if (!passed(mid, isRightWritten)) return 3
  return passed(high, isRightWritten) ? 5 : 4
}

// What the marks say, in the note's own words: "핵심 개념 5개 중 4개 알았음 · 틀린 문제 2개 중 1개 맞힘".
export function reviewSummary(rows: JudgedItem[], value: number) {
  const parts: string[] = []
  const of = (type: ReviewItemType) => rows.filter((r) => r.item.type === type)
  const concepts = of("concept")
  const problems = of("problem")
  const headings = of("heading")
  if (concepts.length) parts.push(`핵심 개념 ${concepts.length}개 중 ${concepts.filter(isRight).length}개 알았음`)
  if (problems.length) parts.push(`틀린 문제 ${problems.length}개 중 ${problems.filter(isRight).length}개 맞힘`)
  if (headings.length) parts.push(`소제목 ${headings.length}개 중 ${headings.filter(isRight).length}개 떠올림`)
  const hint =
    value <= 2
      ? "헷갈리거나 몰랐던 곳을 지금 노트에서 다시 보고, 다음 복습에서 확인해요."
      : "떠올리기로 확인할 수 있는 만큼 확인했어요. AI 창의 확인 문제에 답을 써서 맞히면 4 · 5까지 올라가요."
  return { line: parts.join(" · "), hint }
}

// One line for the record (학습 기록): what was reviewed and how it went.
export function reviewRecordText(rows: JudgedItem[], cue: ReviewCue) {
  if (cue === "none") return { studyContent: "복습: 노트를 다시 읽고 이해도를 골랐어요", difficulties: "" }
  const count = (j: Judgment) => rows.filter((r) => r.judgment === j).length
  const missed = rows.filter((r) => r.judgment !== "right").map((r) => r.item.label.split(/[:：\n]/)[0].trim())
  return {
    studyContent: `복습: ${rows.length}개 확인 (알았음 ${count("right")} · 헷갈림 ${count("unsure")} · 몰랐음 ${count("wrong")})`,
    difficulties: missed.length > 0 ? `다시 볼 것: ${missed.join(", ")}`.slice(0, 300) : "",
  }
}
