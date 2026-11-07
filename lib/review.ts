import {
  blocksPlainText,
  conceptBlocks,
  isTextBlock,
  splitConcept,
  wrongProblems,
  type Block,
  type StudyPage,
} from "@/lib/study-pages"

// 복습 화면 (D-34): one screen, one way to judge, one record per note. The items differ by what the note holds;
// the ladder (D-32) and the record are the same for all of them.

export type ReviewLevel = "하" | "중" | "상"
export type ReviewItemType = "card" | "problem" | "heading"
export type Judgment = "wrong" | "unsure" | "right"
// What the note is reviewed with: its items, its headings when it has no items, or nothing (the user picks 1–5).
export type ReviewCue = "items" | "headings" | "none"

export interface ReviewItem {
  blockId: string
  type: ReviewItemType
  level: ReviewLevel
  prompt: string
  answer: string
}

export interface JudgedItem {
  item: ReviewItem
  judgment: Judgment
  // An answer was typed before opening (D-32: 4 and 5 only from written answers).
  written: boolean
}

export const reviewHref = (pageId: string) => `/review?page=${encodeURIComponent(pageId)}`

export const itemTypeInfo: Record<ReviewItemType, { label: string; hint: string; answerLabel: string }> = {
  card: { label: "카드", hint: "뜻을 떠올려 보세요", answerLabel: "뒷면" },
  problem: { label: "문제", hint: "다시 풀어 보세요", answerLabel: "정답 · 풀이" },
  heading: { label: "소제목", hint: "이 소제목 아래에 무엇을 썼는지 떠올려 보세요", answerLabel: "그 아래 본문" },
}

const MAX_HEADINGS = 10

// A heading with what is written under it (up to the next heading). Sections holding only 핵심 개념 · 헷갈린 점
// blocks are left out: they are not something to recall from a heading.
function headingItems(blocks: Block[]): ReviewItem[] {
  const items: ReviewItem[] = []
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i]
    if (!isTextBlock(b) || !["h1", "h2", "h3"].includes(b.type) || !b.text.trim()) continue
    const section: Block[] = []
    for (let j = i + 1; j < blocks.length; j++) {
      const next = blocks[j]
      if (isTextBlock(next) && ["h1", "h2", "h3"].includes(next.type)) break
      if (isTextBlock(next) && (next.type === "concept" || next.type === "confusion")) continue
      section.push(next)
    }
    const answer = blocksPlainText(section).trim()
    if (answer) items.push({ blockId: b.id, type: "heading", level: "중", prompt: b.text.trim(), answer })
    if (items.length === MAX_HEADINGS) break
  }
  return items
}

// 하 → 중 → 상: 핵심 개념 cards (하) first, then a 오답 노트's problems still wrong (중, 적용 by default).
// `problems` is off until the note can be a 오답 노트 (props column, D-27).
export function reviewItems(page: Pick<StudyPage, "blocks">, problems: boolean): { cue: ReviewCue; items: ReviewItem[] } {
  const cards: ReviewItem[] = conceptBlocks(page.blocks).map((b, i) => {
    const { term, detail } = splitConcept(b.text)
    // "용어: 설명" has a front; a concept written as one sentence is recalled from its place in the note.
    return { blockId: b.id, type: "card", level: "하", prompt: term ?? `핵심 개념 ${i + 1}`, answer: detail }
  })
  const wrong: ReviewItem[] = problems
    ? wrongProblems(page.blocks).map((b) => ({
        blockId: b.id,
        type: "problem",
        level: "중",
        prompt: b.text.trim(),
        answer: b.body?.trim() || "정답과 풀이가 비어 있어요. 노트에서 이 문제 안에 적어 두면 다음부터 맞춰 볼 수 있어요.",
      }))
    : []
  const items = [...cards, ...wrong]
  if (items.length > 0) return { cue: "items", items }
  const headings = headingItems(page.blocks)
  return headings.length > 0 ? { cue: "headings", items: headings } : { cue: "none", items: [] }
}

// "카드 3 · 문제 2", "소제목 2개로 떠올리기", "떠올릴 단서 없음".
export function cueSummary(cue: ReviewCue, items: ReviewItem[]) {
  if (cue === "none") return "떠올릴 단서 없음 · 이해도 직접 고르기"
  if (cue === "headings") return `소제목 ${items.length}개로 떠올리기`
  const cards = items.filter((i) => i.type === "card").length
  const problems = items.filter((i) => i.type === "problem").length
  return [cards && `카드 ${cards}`, problems && `문제 ${problems}`].filter(Boolean).join(" · ")
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
  let value = rows.some(isRight) ? 2 : 1
  const baseOk = passed(low.length > 0 ? low : [...mid, ...high], isRight)
  if (!baseOk) return value
  value = 3
  if (!passed(mid, isRightWritten)) return value
  value = 4
  return passed(high, isRightWritten) ? 5 : value
}

// Why the value is what it is, and the way up from here (끝 화면).
export function reviewExplanation(rows: JudgedItem[], cue: ReviewCue, value: number) {
  const reasons: string[] = []
  for (const level of ["하", "중", "상"] as const) {
    const at = rows.filter((r) => r.item.level === level)
    if (at.length === 0) continue
    const name = cue === "headings" ? "소제목" : `${level} 문항`
    // One item can pass a level; say so, so it isn't read as more than it is.
    reasons.push(`${name} ${at.length}개 중 ${at.filter(isRight).length}개 맞음${at.length === 1 ? " · 이 단계는 문항 1개로 확인" : ""}`)
  }
  const unwritten = rows.filter((r) => r.item.level !== "하" && isRight(r) && !r.written).length
  if (unwritten > 0)
    reasons.push(
      cue === "headings"
        ? `맞힌 소제목 ${unwritten}개는 답을 안 써서 4로 세지 않았어요`
        : `맞힌 중 · 상 문항 ${unwritten}개는 답을 안 써서 4 · 5로 세지 않았어요`,
    )

  const hasMid = rows.some((r) => r.item.level === "중")
  const hasHigh = rows.some((r) => r.item.level === "상")
  let hint: string
  if (value <= 2) hint = "틀리거나 헷갈린 문항을 노트에서 다시 보고, 다음 복습에서 확인해요."
  else if (value === 3 && cue === "headings") hint = "소제목 아래 내용을 한 단어라도 써 보고 맞히면 4가 돼요."
  else if (value === 3 && (hasMid || hasHigh)) hint = "중 문항을 한 단어라도 써 보고 맞히면 4가 돼요."
  else if (value === 3) hint = "카드는 하 문항이라 3이 끝이에요. 노트의 AI 창에서 확인 문제(중 · 상)를 풀면 더 오를 수 있어요."
  else if (value === 4 && hasHigh) hint = "상 문항을 한 단어라도 써 보고 맞히면 5가 돼요."
  else if (value === 4) hint = "상 문항이 없어 4가 끝이에요. 비교하거나 이유를 묻는 문항(상)이 있어야 5까지 오를 수 있어요."
  else hint = "이번 복습에서는 상 단계까지 확인했어요."
  return { reasons, hint }
}

// One line for the record (학습 기록): what was reviewed and how it went.
export function reviewRecordText(rows: JudgedItem[], cue: ReviewCue) {
  if (cue === "none") return { studyContent: "복습: 노트를 다시 읽고 이해도를 골랐어요", difficulties: "" }
  const count = (j: Judgment) => rows.filter((r) => r.judgment === j).length
  const what = cue === "headings" ? `소제목 ${rows.length}개로 떠올리기` : `문항 ${rows.length}개`
  const missed = rows.filter((r) => r.judgment !== "right").map((r) => r.item.prompt)
  return {
    studyContent: `복습: ${what} (맞음 ${count("right")} · 헷갈림 ${count("unsure")} · 틀림 ${count("wrong")})`,
    difficulties: missed.length > 0 ? `다시 볼 것: ${missed.join(", ")}`.slice(0, 300) : "",
  }
}
