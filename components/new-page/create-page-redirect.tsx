"use client"

import { useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { useDataStatus } from "@/lib/db/sync"
import { DataStatusView } from "@/components/data-status-notice"
import { createPage, nodeExists, useWorkspace } from "@/lib/workspace"

// "+ 새 페이지" (/new, /new?parent=<group or page>): makes an untitled page right away and opens it.
// The template is picked inside the page (PageStarters), so there is no form in between.
// Waits for the workspace to load so the parent can be checked; an unknown parent falls back to the top level.
export function CreatePageRedirect({ parentId }: { parentId?: string }) {
  const router = useRouter()
  const status = useDataStatus()
  const workspace = useWorkspace()
  const created = useRef(false)

  useEffect(() => {
    if (status.phase !== "ready" || created.current) return
    created.current = true
    const parent = parentId && nodeExists(workspace, parentId) ? parentId : null
    const id = createPage({ title: "", starterId: "blank", parentId: parent })
    router.replace(`/record/${id}?new=1`)
  }, [status.phase, parentId, workspace, router])

  if (status.phase !== "ready") return <DataStatusView status={status} />
  return (
    <p role="status" className="px-6 py-12 text-sm text-muted-foreground">
      새 페이지를 만드는 중…
    </p>
  )
}
