"use client"

import { useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { AlertCircle, FilePlus2, Loader2 } from "lucide-react"
import { loadUserData, useDataStatus, type DataStatus } from "@/lib/db/sync"
import { importExampleData, useWorkspace } from "@/lib/workspace"

// Home banner for the data load: loading, a failed load with retry, or a first-step guide for an empty workspace.
export function DataStatusNotice() {
  const status = useDataStatus()
  const { groups, pages } = useWorkspace()
  const [importing, setImporting] = useState(false)

  const handleImport = async () => {
    setImporting(true)
    const result = await importExampleData()
    setImporting(false)
    if (result === "not-empty") {
      // The DB already has rows this screen hasn't loaded (another tab); show them instead of importing.
      toast.info("이미 저장된 데이터가 있어서 예시 데이터를 가져오지 않았어요. 저장된 데이터를 다시 불러올게요.")
      void loadUserData()
    }
  }

  if (status.phase === "loading") {
    return (
      <p role="status" className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        학습 데이터를 불러오는 중이에요…
      </p>
    )
  }

  if (status.phase === "error") {
    return (
      <div role="alert" className="mb-4 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <div className="flex-1">
          <p className="font-medium">학습 데이터를 불러오지 못했어요.</p>
          <p className="mt-0.5 text-xs text-red-600/90">{status.message}</p>
        </div>
        <button
          type="button"
          onClick={() => void loadUserData()}
          className="shrink-0 rounded-lg border border-red-200 bg-background px-3 py-1.5 text-xs font-medium text-red-700 transition-colors hover:bg-red-100"
        >
          다시 시도
        </button>
      </div>
    )
  }

  if (pages.length > 0) return null

  return (
    <div className="mb-6 flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/50 px-6 py-8 text-center">
      <div className="mb-3 flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <FilePlus2 className="size-5" />
      </div>
      <p className="text-sm font-medium text-foreground">아직 학습 페이지가 없어요</p>
      <p className="mt-1 max-w-xs text-xs text-muted-foreground text-pretty">
        학습 페이지를 만들고 그 페이지에서 학습 기록을 추가하면 홈에 오늘의 기록과 주간 통계가 보여요.
      </p>
      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        <Link
          href="/new"
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-700"
        >
          첫 학습 페이지 만들기
        </Link>
        {/* Only for a fully empty workspace; importExampleData re-checks the DB before writing. */}
        {groups.length === 0 && (
          <button
            type="button"
            onClick={() => void handleImport()}
            disabled={importing}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {importing && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            {importing ? "가져오는 중…" : "예시 데이터 가져오기"}
          </button>
        )}
      </div>
      {groups.length === 0 && (
        <p className="mt-2 max-w-xs text-xs text-muted-foreground text-pretty">
          예시 데이터는 내 계정에 저장되고, 일반 페이지처럼 고치거나 지울 수 있어요.
        </p>
      )}
    </div>
  )
}

// Full-page stand-in while a page or subject can't be looked up yet, so "찾을 수 없어요" never flashes during the load.
export function DataStatusView({ status }: { status: DataStatus }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-6 py-32 text-center">
      {status.phase === "error" ? (
        <>
          <AlertCircle className="mb-3 size-6 text-red-600" aria-hidden="true" />
          <p role="alert" className="text-base font-medium text-foreground">학습 데이터를 불러오지 못했어요</p>
          <p className="mt-1 text-sm text-muted-foreground">{status.message}</p>
          <button
            type="button"
            onClick={() => void loadUserData()}
            className="mt-5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-700"
          >
            다시 시도
          </button>
        </>
      ) : (
        <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          불러오는 중이에요…
        </p>
      )}
    </div>
  )
}
