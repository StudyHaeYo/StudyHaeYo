import { isTextBlock, splitConcept, wrongProblems, type Block, type StudyPage } from "@/lib/study-pages"

// 복습 (D-34): reviewing happens in the note itself, whatever shape it was written in. What gets covered comes from
// how people already write notes (Notion habits), not from a format the app asks for:
//   - a heading: what is written under it
//   - a toggle: what is inside it (a question as the title, the answer inside); in a 오답 노트, the problems still wrong
//   - a 핵심 개념 block: its explanation
//   - a note with none of these: each paragraph, behind its first words ("프로세스: …")
// The user recalls, opens, and marks each; the marks set 이해도 by the ladder (D-32) and leave one record.

export type ReviewLevel = "하" | "중" | "상"
export type ReviewItemType = "heading" | "toggle" | "problem" | "concept" | "paragraph"
// right = 알았음 / 맞힘, unsure = 헷갈림, wrong = 몰랐음 / 틀림.
export type Judgment = "wrong" | "unsure" | "right"

export interface ReviewItem {
  blockId: string
  type: ReviewItemType
  level: ReviewLevel
  // What the record calls it, and what a covered paragraph still shows as its cue.
  label: string
  // Blocks hidden until the item is opened (a heading's section). Other items cover part of their own block.
  hides: string[]
}

export interface JudgedItem {
  item: ReviewItem
  judgment: Judgment
  // An answer was written before opening. The in-note review has no answer box, so this is false there: written
  // answers come from the AI 창's 확인 문제 (D-32: 4 and 5 only from written answers).
  written: boolean
}

export const reviewHref = (pageId: string) => `/record/${pageId}?mode=review`

const HEADINGS = new Set(["h1", "h2", "h3"])
// Blocks that are their own item (or a question) and so stay in sight under a covered heading.
const OWN_ITEM = new Set(["toggle", "concept", "confusion"])
const PARAGRAPHS = new Set(["p", "li", "ol", "quote", "callout"])
const MAX_ITEMS = 12

// A plain boolean, not a type guard: a guard would narrow the "not a heading" branch to non-text blocks.
const isHeading = (b: Block): boolean => isTextBlock(b) && HEADINGS.has(b.type)

function hasContent(b: Block) {
  return !isTextBlock(b) || b.text.trim() !== "" || !!b.body?.trim()
}

// The first words of a paragraph, kept in sight as its cue: up to a colon ("프로세스: …"), else two words.
export function paragraphCue(text: string) {
  const term = splitConcept(text).term
  if (term) return term
  const words = text.trim().split(/\s+/)
  return words.slice(0, Math.min(2, Math.max(1, words.length - 1))).join(" ")
}

// In document order. `problems`: the note is a 오답 노트 (props column ready, D-27), so its toggles are problems and
// only the ones still wrong come back.
export function reviewItems(page: Pick<StudyPage, "blocks">, problems: boolean): ReviewItem[] {
  const blocks = page.blocks
  const wrong = new Set(problems ? wrongProblems(blocks).map((b) => b.id) : [])
  const items: ReviewItem[] = []
  const hasStructure = blocks.some((b) => isHeading(b) || (isTextBlock(b) && (b.type === "toggle" || b.type === "concept")))

  for (let i = 0; i < blocks.length && items.length < MAX_ITEMS; i++) {
    const b = blocks[i]
    if (!isTextBlock(b)) continue
    if (HEADINGS.has(b.type) && b.text.trim()) {
      const hides: string[] = []
      for (let j = i + 1; j < blocks.length; j++) {
        const next = blocks[j]
        if (isHeading(next)) break
        if (isTextBlock(next) && OWN_ITEM.has(next.type)) continue
        if (hasContent(next)) hides.push(next.id)
      }
      if (hides.length > 0) items.push({ blockId: b.id, type: "heading", level: "하", label: b.text.trim(), hides })
    } else if (b.type === "toggle" && b.text.trim()) {
      if (problems ? wrong.has(b.id) : !!b.body?.trim())
        items.push({ blockId: b.id, type: problems ? "problem" : "toggle", level: "하", label: b.text.trim(), hides: [] })
    } else if (b.type === "concept" && b.text.trim()) {
      const { term, detail } = splitConcept(b.text)
      const label = term ?? paragraphCue(b.text)
      // Only when something is left to cover: "프로세스" alone has nothing behind it.
      if (term ? detail.trim() : label !== b.text.trim()) items.push({ blockId: b.id, type: "concept", level: "하", label, hides: [] })
    } else if (!hasStructure && PARAGRAPHS.has(b.type) && b.text.trim().split(/\s+/).length > 1) {
      items.push({ blockId: b.id, type: "paragraph", level: "하", label: paragraphCue(b.text), hides: [] })
    }
  }
  return items
}

// A level is passed with every item right, or one miss when it has 3 or more (D-32, same as the AI quiz).
function passed(rows: JudgedItem[], ok: (row: JudgedItem) => boolean) {
  const right = rows.filter(ok).length
  return rows.length > 0 && right >= rows.length - (rows.length >= 3 ? 1 : 0)
}

const isRight = (row: JudgedItem) => row.judgment === "right"
const isRightWritten = (row: JudgedItem) => row.judgment === "right" && row.written

// 사다리 (D-32): anything recalled, even 헷갈림 → 2 (많이 헷갈림), the lowest level asked passed → 3, 중 passed with
// written answers → 4, then 상 passed with written answers → 5. Recalling in the note is all one level, so it tops
// out at 3 there.
export function reviewUnderstanding(rows: JudgedItem[]) {
  const at = (level: ReviewLevel) => rows.filter((r) => r.item.level === level)
  const low = at("하")
  const mid = at("중")
  const high = at("상")
  const value = rows.some((r) => r.judgment !== "wrong") ? 2 : 1
  if (!passed(low.length > 0 ? low : [...mid, ...high], isRight)) return value
  if (!passed(mid, isRightWritten)) return 3
  return passed(high, isRightWritten) ? 5 : 4
}

// What the marks say: "떠올릴 곳 5개 중 4개 알았음" (a 오답 노트: "틀린 문제 2개 중 1개 맞힘").
export function reviewSummary(rows: JudgedItem[], value: number) {
  const problems = rows.filter((r) => r.item.type === "problem")
  const others = rows.filter((r) => r.item.type !== "problem")
  const parts: string[] = []
  if (others.length) parts.push(`떠올릴 곳 ${others.length}개 중 ${others.filter(isRight).length}개 알았음`)
  if (problems.length) parts.push(`틀린 문제 ${problems.length}개 중 ${problems.filter(isRight).length}개 맞힘`)
  const hint =
    value <= 2
      ? "헷갈리거나 몰랐던 곳을 지금 다시 읽어 두면 다음 복습에서 확인해요."
      : "AI 창의 확인 문제에 답을 써서 맞히면 이해도 4 · 5까지 올라가요."
  return { line: parts.join(" · "), hint }
}

// One line for the record (학습 기록): what was reviewed and how it went.
export function reviewRecordText(rows: JudgedItem[]) {
  if (rows.length === 0) return { studyContent: "복습: 노트를 다시 읽고 이해도를 골랐어요", difficulties: "" }
  const count = (j: Judgment) => rows.filter((r) => r.judgment === j).length
  const missed = rows.filter((r) => r.judgment !== "right").map((r) => r.item.label)
  return {
    studyContent: `복습: ${rows.length}곳 확인 (알았음 ${count("right")} · 헷갈림 ${count("unsure")} · 몰랐음 ${count("wrong")})`,
    difficulties: missed.length > 0 ? `다시 볼 것: ${missed.join(", ")}`.slice(0, 300) : "",
  }
}
