import Link from "next/link"
import { ChevronRight, Flame, Sparkles } from "lucide-react"

interface SubjectHeaderProps {
  ancestors: string[]
  subjectName: string
}

export function SubjectHeader({ ancestors, subjectName }: SubjectHeaderProps) {
  return (
    <header className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <nav aria-label="breadcrumb">
          <ol className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
            {ancestors.map((name, i) => (
              <li key={`${i}-${name}`} className="flex items-center gap-1">
                {name}
                <ChevronRight className="size-3.5" aria-hidden="true" />
              </li>
            ))}
            <li aria-current="page" className="font-medium text-foreground">
              {subjectName}
            </li>
          </ol>
        </nav>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground text-balance">
          {subjectName}
        </h1>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Link
          href="/study"
          className="flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-4 text-base font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700"
        >
          <Flame className="size-5" />
          공부 시작하기
        </Link>
        <Link
          href="/ai"
          className="flex items-center justify-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-5 py-4 text-base font-semibold text-indigo-700 shadow-sm transition-colors hover:bg-indigo-100"
        >
          <Sparkles className="size-5" />
          AI로 요약하기
        </Link>
      </div>
    </header>
  )
}
