import Link from "next/link"
import { BookOpen } from "lucide-react"

export function AuthShell({
  title,
  description,
  children,
  footer,
}: {
  title: string
  // Only when it says something the title does not (비밀번호 찾기: a link will be mailed).
  description?: string
  children: React.ReactNode
  footer: React.ReactNode
}) {
  return (
    <main id="main" tabIndex={-1} className="flex min-h-screen outline-none items-center justify-center bg-background px-4 py-10 text-foreground">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <Link href="/" className="flex items-center justify-center gap-2 self-center rounded-lg">
          <span className="flex size-8 items-center justify-center rounded-lg bg-action-600 text-action-foreground">
            <BookOpen className="size-4" aria-hidden="true" />
          </span>
          <span className="text-base font-semibold tracking-tight text-foreground">스터디 해요</span>
        </Link>

        <section className="flex flex-col gap-6 rounded-xl border border-border bg-card p-6">
          <header className="flex flex-col gap-1">
            <h1 className="text-xl font-semibold tracking-tight text-card-foreground text-balance">
              {title}
            </h1>
            {description && <p className="text-sm leading-relaxed text-muted-foreground text-pretty">{description}</p>}
          </header>
          {children}
        </section>

        <p className="text-center text-sm text-muted-foreground">{footer}</p>
      </div>
    </main>
  )
}
