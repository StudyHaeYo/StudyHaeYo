"use client"

import { useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { AlertCircle, Loader2 } from "lucide-react"
import { openQuickRecord } from "@/components/record/quick-record-dialog"
import { loadUserData, useDataStatus, type DataStatus } from "@/lib/db/sync"
import { importExampleData, useWorkspace } from "@/lib/workspace"

// Home banner for the data load: loading, a failed load with retry, or a first-step guide for an empty workspace.
export function DataStatusNotice() {
  const status = useDataStatus()
  const { groups, pages, subjectRecords } = useWorkspace()
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

  if (pages.length > 0 || subjectRecords.length > 0) return null

  // 시작하기: what to do first, in three lines. Shown until the first page or record exists.
  return (
    <section aria-labelledby="getting-started" className="mb-6 rounded-xl border border-border bg-card px-5 py-5">
      <h2 id="getting-started" className="text-base font-semibold text-foreground">
        시작하기
      </h2>
      <ol className="mt-3 flex flex-col gap-3 text-sm text-foreground">
        <Step n={1}>
          공부를 마치면 과목 · 시간 · 이해도를 기록해요.{" "}
          <button type="button" onClick={() => openQuickRecord()} className={stepLink}>
            + 기록 남기기
          </button>
        </Step>
        <Step n={2}>
          정리할 노트가 필요하면 템플릿으로 페이지를 만들어요.{" "}
          <Link href="/new" className={stepLink}>
            새 페이지
          </Link>
        </Step>
        <Step n={3}>기록이 쌓이면 복습할 날과 주간 통계가 홈에 보여요.</Step>
      </ol>
      {/* Only for a fully empty workspace; importExampleData re-checks the DB before writing. */}
      {groups.length === 0 && (
        <p className="mt-4 border-t border-border pt-3 text-xs text-muted-foreground text-pretty">
          먼저 둘러보고 싶다면{" "}
          <button
            type="button"
            onClick={() => void handleImport()}
            disabled={importing}
            className="inline-flex items-center gap-1 font-medium text-foreground underline underline-offset-4 disabled:opacity-60"
          >
            {importing && <Loader2 className="size-3 animate-spin" aria-hidden="true" />}
            {importing ? "가져오는 중…" : "예시 데이터 가져오기"}
          </button>
          . 내 계정에 저장되고, 일반 페이지처럼 고치거나 지울 수 있어요.
        </p>
      )}
    </section>
  )
}

const stepLink = "font-medium text-indigo-700 underline-offset-4 hover:underline"

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
        {n}
      </span>
      <span className="leading-relaxed">{children}</span>
    </li>
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
            className="mt-5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
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
