"use client"

import { AlertCircle, Loader2 } from "lucide-react"
import { loadUserData, useDataStatus, type DataStatus } from "@/lib/db/sync"
import { button } from "@/components/ui-styles"

// Home banner for the data load: loading, or a failed load with retry.
export function DataStatusNotice() {
  const status = useDataStatus()
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
      <div role="alert" className="mb-4 flex items-start gap-3 rounded-xl border border-danger-200 bg-danger-50 p-4 text-sm text-danger-700">
        <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <div className="flex-1">
          <p className="font-medium">학습 데이터를 불러오지 못했어요.</p>
          <p className="mt-0.5 text-xs text-danger-600/90">{status.message}</p>
        </div>
        <button
          type="button"
          onClick={() => void loadUserData()}
          className={button("secondary", "sm")}
        >
          다시 시도
        </button>
      </div>
    )
  }

  // A brand-new account sees FirstRun in 오늘's 지금 할 것 (재설계 D-43), not a box of instructions here.
  return null
}

// Full-page stand-in while a page or subject can't be looked up yet, so "찾을 수 없어요" never flashes during the load.
export function DataStatusView({ status }: { status: DataStatus }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-6 py-32 text-center">
      {status.phase === "error" ? (
        <>
          <AlertCircle className="mb-3 size-6 text-danger-600" aria-hidden="true" />
          <p role="alert" className="text-base font-medium text-foreground">학습 데이터를 불러오지 못했어요</p>
          <p className="mt-1 text-sm text-muted-foreground">{status.message}</p>
          <button
            type="button"
            onClick={() => void loadUserData()}
            className={button("primary", "md", "mt-5")}
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
