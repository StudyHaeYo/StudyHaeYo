"use client"

import { createContext, useContext } from "react"
import type { StudyPage } from "@/lib/study-pages"

// The workspace's pages, for blocks that point at other pages (페이지 링크). Provided by the page view so the
// editor doesn't import lib/workspace (workspace → templates → page bodies → editor would be a cycle).
export const PagesContext = createContext<StudyPage[]>([])

export const usePagesForLinks = () => useContext(PagesContext)
