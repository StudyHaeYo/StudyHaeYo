import type { ReactNode } from "react"
import { Sidebar } from "@/components/sidebar"

// One frame for every screen that is not a note (2026-11-14, "화면마다 따로 만든 것 같다"): the same sidebar, the same
// paddings, and one of two column widths. `wide` is for screens that compare things side by side (홈 · 학습 분석);
// everything that reads top to bottom (학습 기록 · 학습 계획 · 과목 · 설정) uses the note's width, so moving between a
// note and its lists does not shift the text column.
export function PageShell({ width = "narrow", children }: { width?: "narrow" | "wide"; children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground md:flex-row">
      <Sidebar />
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 md:h-screen md:overflow-y-auto lg:px-10 lg:py-10">
        <div className={`mx-auto flex flex-col ${width === "wide" ? "max-w-6xl" : "max-w-3xl"}`}>{children}</div>
      </main>
    </div>
  )
}

// The top of a screen: a small line above (where this is, or the date), the title, one line under it, and the
// screen's actions on the right of the title. Every screen starts at the same height with the same sizes.
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: ReactNode
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
}) {
  return (
    // Without a line above, the title still starts where it does on screens that have one (md and up).
    <header className={`flex flex-wrap items-end justify-between gap-x-4 gap-y-3 pb-8 ${eyebrow ? "" : "md:pt-[1.625rem]"}`}>
      <div className="min-w-0">
        {eyebrow && <div className="mb-1.5 text-[13px] text-muted-foreground">{eyebrow}</div>}
        <h1 className="text-balance text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
        {description && <div className="mt-1.5 text-pretty text-sm leading-relaxed text-muted-foreground">{description}</div>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  )
}

// A section's heading row: the name, how many (grey), and at most one action on the right.
export function SectionHeader({
  id,
  title,
  count,
  action,
}: {
  id?: string
  title: ReactNode
  count?: number | string | null
  action?: ReactNode
}) {
  return (
    <div className="flex min-h-9 items-center justify-between gap-4">
      <h2 id={id} className={sectionTitle}>
        {title}
        {count !== undefined && count !== null && <span className="ml-2 font-normal tabular-nums text-muted-foreground">{count}</span>}
      </h2>
      {action}
    </div>
  )
}

export const sectionTitle = "text-[15px] font-semibold text-foreground"

// Buttons: one filled (the screen's main action, at most one per screen) and one outlined (everything else).
const buttonBase =
  "inline-flex h-9 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action-500 disabled:opacity-50 [&_svg]:size-4"
export const primaryButton = `${buttonBase} bg-action-600 text-action-foreground hover:bg-action-700`
export const secondaryButton = `${buttonBase} border border-border bg-background text-foreground hover:bg-accent`

// A boxed group (settings, analytics, the session timer): one radius, a hairline, no shadow.
export const surface = "rounded-xl border border-border bg-card"
// What a list shows before it has anything.
export const emptyState = "rounded-xl border border-dashed border-border px-6 py-10 text-center text-sm leading-relaxed text-muted-foreground"

// A row of plain numbers under a header (과목 · 학습 분석): label above, value below, hairlines above and below.
export function StatStrip({ label, items }: { label: string; items: { label: string; value: ReactNode; hint?: string }[] }) {
  return (
    <section aria-label={label}>
      <dl
        className={`grid gap-x-4 gap-y-4 border-y border-border py-4 sm:gap-x-6 ${items.length === 3 ? "grid-cols-3" : "grid-cols-2 sm:grid-cols-4"}`}
      >
        {items.map((item) => (
          <div key={item.label} className="flex min-w-0 flex-col gap-1">
            <dt className="text-xs text-muted-foreground">{item.label}</dt>
            <dd className="text-base font-semibold leading-tight tracking-tight tabular-nums text-foreground sm:text-lg">{item.value}</dd>
            {item.hint && <dd className="hidden text-xs text-muted-foreground sm:block">{item.hint}</dd>}
          </div>
        ))}
      </dl>
    </section>
  )
}
