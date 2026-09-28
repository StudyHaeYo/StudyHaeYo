import { Gauge } from "lucide-react"
import { subjectMastery } from "@/lib/learning-os"

export function SubjectMastery({ title = "나의 학습 상태" }: { title?: string }) {
  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <Gauge className="size-4 text-indigo-600" />
        <h2 className="text-sm font-medium text-card-foreground">{title}</h2>
      </div>
      <ul className="flex flex-col gap-4">
        {subjectMastery.map((item) => (
          <li key={item.subject}>
            <div className="mb-1.5 flex items-center justify-between text-sm">
              <span className="text-card-foreground">{item.subject}</span>
              <span className={`font-semibold ${item.progress < 50 ? "text-amber-600" : "text-indigo-600"}`}>
                {item.progress}%
              </span>
            </div>
            <div
              className="h-2 w-full overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-valuenow={item.progress}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${item.subject} 학습 상태`}
            >
              <div
                className={`h-full rounded-full ${item.progress < 50 ? "bg-amber-500" : "bg-indigo-600"}`}
                style={{ width: `${item.progress}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
