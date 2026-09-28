"use client"

import { useState } from "react"
import { RefreshCw, Sparkles } from "lucide-react"

const summaryVariants = [
  [
    "해시테이블은 해시 함수로 키를 인덱스로 변환해 평균 O(1)로 탐색한다.",
    "충돌은 체이닝 또는 개방 주소법(선형·이차 탐사, 이중 해싱)으로 해결한다.",
    "로드 팩터가 커지면 성능이 떨어지므로 적절한 시점에 리해싱이 필요하다.",
  ],
  [
    "키 → 해시 함수 → 배열 인덱스 구조로 빠른 삽입·삭제·탐색을 지원한다.",
    "개방 주소법은 빈 칸을 탐사하고, 체이닝은 같은 칸에 연결 리스트로 저장한다.",
    "이차 탐사는 1차 클러스터링을 줄이지만 2차 클러스터링은 남는다.",
  ],
]

export function SummaryTab() {
  const [index, setIndex] = useState(0)
  const [loading, setLoading] = useState(false)

  const handleRegenerate = () => {
    setLoading(true)
    setTimeout(() => {
      setIndex((i) => (i + 1) % summaryVariants.length)
      setLoading(false)
    }, 700)
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
            <Sparkles className="size-4" />
          </span>
          <h2 className="text-sm font-semibold text-card-foreground">3줄 요약</h2>
        </div>
        <ol className={`flex flex-col gap-3 transition-opacity ${loading ? "opacity-40" : ""}`}>
          {summaryVariants[index].map((line, i) => (
            <li key={line} className="flex gap-3 text-sm leading-relaxed text-foreground">
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
                {i + 1}
              </span>
              {line}
            </li>
          ))}
        </ol>
      </section>

      <button
        onClick={handleRegenerate}
        disabled={loading}
        className="inline-flex items-center justify-center gap-1.5 self-start rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-accent disabled:opacity-60"
      >
        <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
        다시 요약하기
      </button>
    </div>
  )
}
