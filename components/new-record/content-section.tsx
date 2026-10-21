"use client"

import { useEffect, useRef } from "react"
import type { LucideIcon } from "lucide-react"

interface ContentSectionProps {
  icon: LucideIcon
  title: string
  placeholder: string
  value: string
  optional?: boolean
  onChange: (value: string) => void
}

export function ContentSection({
  icon: Icon,
  title,
  placeholder,
  value,
  optional = false,
  onChange,
}: ContentSectionProps) {
  const ref = useRef<HTMLTextAreaElement>(null)

  // Auto-grow the textarea to fit its content.
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = `${el.scrollHeight}px`
  }, [value])

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex size-8 items-center justify-center rounded-lg bg-muted text-foreground">
          <Icon className="size-4" />
        </span>
        <h2 className="text-sm font-semibold text-card-foreground">{title}</h2>
        {optional && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
            선택
          </span>
        )}
      </div>
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={2}
        aria-label={title}
        className="w-full resize-none bg-transparent text-sm leading-relaxed text-foreground outline-none placeholder:text-muted-foreground/60"
      />
    </section>
  )
}
