"use client"

import { useState } from "react"
import { Eye, EyeOff, Plus } from "lucide-react"

interface Question {
  id: string
  prompt: string
  options: string[]
  answer: number
}

const questionPool: Question[] = [
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

export function QuizTab() {
  const [count, setCount] = useState(2)

  return (
    <div className="flex flex-col gap-4">
      {questionPool.slice(0, count).map((q, i) => (
        <QuestionCard key={q.id} number={i + 1} question={q} />
      ))}

      {count < questionPool.length && (
        <button
          onClick={() => setCount((c) => Math.min(c + 2, questionPool.length))}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-border bg-card py-3 text-sm font-medium text-muted-foreground transition-colors hover:border-indigo-300 hover:text-indigo-600"
        >
          <Plus className="size-4" />
          문제 더 만들기
        </button>
      )}
    </div>
  )
}

function QuestionCard({ number, question }: { number: number; question: Question }) {
  const [showAnswer, setShowAnswer] = useState(false)

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <h3 className="text-sm font-semibold leading-relaxed text-card-foreground">
          <span className="mr-1.5 text-indigo-600">Q{number}.</span>
          {question.prompt}
        </h3>
        <button
          onClick={() => setShowAnswer((v) => !v)}
          aria-pressed={showAnswer}
          className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          {showAnswer ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
          {showAnswer ? "정답 숨기기" : "정답 보기"}
        </button>
      </div>
      <ul className="grid gap-2 sm:grid-cols-2">
        {question.options.map((option, i) => {
          const correct = showAnswer && i === question.answer
          return (
            <li
              key={option}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm transition-colors ${
                correct
                  ? "border-indigo-300 bg-indigo-50 font-medium text-indigo-700"
                  : "border-border text-foreground"
              }`}
            >
              <span
                className={`flex size-5 shrink-0 items-center justify-center rounded-full text-xs font-medium ${
                  correct ? "bg-indigo-600 text-white" : "bg-muted text-muted-foreground"
                }`}
              >
                {i + 1}
              </span>
              {option}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
