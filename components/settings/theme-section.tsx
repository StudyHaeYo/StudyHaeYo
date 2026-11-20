"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { surface } from "@/components/page-shell"
import { THEME_CHOICES, themeCookie, type ThemeChoice } from "@/lib/theme"

// 설정 > 화면(D-48): 밝게 · 어둡게 · 기기 설정 따라. `initial` comes from the cookie the server read, so the first
// render matches the server's (hydration safe). The choice lives in this browser's cookie only.
export function ThemeSection({ initial }: { initial: ThemeChoice }) {
  const router = useRouter()
  const [choice, setChoice] = useState<ThemeChoice>(initial)

  const choose = (next: ThemeChoice) => {
    if (next === choice) return
    setChoice(next)
    document.cookie = themeCookie(next)
    // Switch every color at once: without this, buttons with a color transition would fade a beat behind the page.
    const freeze = document.createElement("style")
    freeze.textContent = "*,*::before,*::after{transition:none!important}"
    document.head.appendChild(freeze)
    document.documentElement.dataset.theme = next
    void window.getComputedStyle(document.body).backgroundColor // apply the new colors before transitions return
    requestAnimationFrame(() => freeze.remove())
    // The root layout reads the cookie: refresh so its <html data-theme>, the toasts and the browser bar follow.
    router.refresh()
  }

  return (
    <section aria-labelledby="settings-theme" className={surface}>
      <div className="border-b border-border px-5 py-3">
        <h2 id="settings-theme" className="text-sm font-semibold text-card-foreground">
          화면
        </h2>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-5 py-4 text-sm">
        <span id="settings-theme-label" className="text-muted-foreground">
          테마
        </span>
        <div role="group" aria-labelledby="settings-theme-label" className="flex rounded-lg bg-muted p-0.5">
          {THEME_CHOICES.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={choice === option.value}
              onClick={() => choose(option.value)}
              className={`touch-hit rounded-md px-3 py-1.5 font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-action-500 ${
                choice === option.value
                  ? "bg-background text-foreground ring-1 ring-border"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}
