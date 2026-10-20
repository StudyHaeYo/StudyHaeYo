import { ChevronRight } from "lucide-react"

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

    </header>
  )
}
