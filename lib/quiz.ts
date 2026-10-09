export interface Question {
  id: string
  prompt: string
  options: string[]
  answer: number
}

export type GradeResult = "correct" | "incorrect" | "ungradable"

export const questionPool: Question[] = [
  {
    id: "q1",
    prompt: "해시테이블의 평균 탐색 시간 복잡도는?",
    options: ["O(1)", "O(log n)", "O(n)", "O(n log n)"],
    answer: 0,
  },
  {
    id: "q2",
    prompt: "다음 중 개방 주소법에 해당하지 않는 충돌 해결 방식은?",
    options: ["선형 탐사", "이차 탐사", "이중 해싱", "체이닝"],
    answer: 3,
  },
  {
    id: "q3",
    prompt: "로드 팩터(load factor)의 정의로 옳은 것은?",
    options: ["버킷 수 / 저장된 키 수", "저장된 키 수 / 버킷 수", "충돌 횟수 / 키 수", "해시 함수 개수"],
    answer: 1,
  },
  {
    id: "q4",
    prompt: "이차 탐사가 주로 완화하는 문제는?",
    options: ["2차 클러스터링", "메모리 누수", "1차 클러스터링", "스택 오버플로"],
    answer: 2,
  },
]

function isValidIndex(value: unknown, length: number): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value < length
}

/** 정답 데이터가 없거나 범위를 벗어나면 앱을 멈추지 않고 "ungradable"을 반환한다. */
export function hasValidAnswer(question: Partial<Question> | null | undefined): boolean {
  if (!question || !Array.isArray(question.options)) return false
  return isValidIndex(question.answer, question.options.length)
}

export function gradeAnswer(
  question: Partial<Question> | null | undefined,
  selected: unknown,
): GradeResult {
  if (!hasValidAnswer(question)) return "ungradable"
  const { options, answer } = question as Question
  if (!isValidIndex(selected, options.length)) return "ungradable"
  return selected === answer ? "correct" : "incorrect"
}
