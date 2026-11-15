"use client"

import { useEffect } from "react"

// The browser tab's title for screens whose name is only known on the client (a note's or a subject's title, or a
// "use client" page that cannot export metadata). Shape: "<screen> · 스터디 해요", like the metadata titles.
// Next re-applies the layout's <title> after the page mounts (it streams metadata), so a single write is undone: the
// title is written again whenever the head changes, but only while this screen is still the one on show. Leaving
// for a screen with the same metadata title (Home) puts the earlier title back, since Next has nothing to change.
export function useDocumentTitle(title: string | null | undefined) {
  useEffect(() => {
    if (!title) return
    const wanted = `${title} · 스터디 해요`
    const path = window.location.pathname
    const previous = document.title
    const apply = () => {
      if (window.location.pathname === path && document.title !== wanted) document.title = wanted
    }
    apply()
    const observer = new MutationObserver(apply)
    observer.observe(document.head, { childList: true, subtree: true, characterData: true })
    return () => {
      observer.disconnect()
      if (document.title === wanted) document.title = previous === wanted ? "스터디 해요" : previous
    }
  }, [title])
}
