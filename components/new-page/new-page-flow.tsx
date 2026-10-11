"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Check, ChevronRight, FolderOpen } from "lucide-react"
import { defaultTemplateId, templateRegistry, type TemplateId } from "@/lib/templates"
import { createPage, flattenTree, nodeExists, nodePath, useWorkspace } from "@/lib/workspace"

const ROOT = "__root__"

export function NewPageFlow({ contextParentId }: { contextParentId?: string }) {
  const router = useRouter()
  const workspace = useWorkspace()
  const locations = flattenTree(workspace)
  const hasContext = nodeExists(workspace, contextParentId)
  const defaultLocation = hasContext ? (contextParentId as string) : ROOT

  const [templateId, setTemplateId] = useState<TemplateId>(defaultTemplateId)
  const [title, setTitle] = useState("")
  const [location, setLocation] = useState(defaultLocation)
  const [pickingLocation, setPickingLocation] = useState(!hasContext)
  const [showError, setShowError] = useState(false)

  const contextPath = hasContext ? nodePath(workspace, contextParentId ?? null) : []
  const titleMissing = title.trim().length === 0

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    if (titleMissing) {
      setShowError(true)
      return
    }
    const id = createPage({ title, templateId, parentId: location === ROOT ? null : location })
    router.push(`/record/${id}`)
  }

  const fieldClass =
    "w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/60 focus:ring-2 focus:ring-indigo-500"

  return (
    <form onSubmit={handleCreate} noValidate className="mx-auto flex max-w-2xl flex-col gap-8">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-balance text-2xl font-semibold tracking-tight">새 페이지</h1>
        <p className="text-pretty text-sm text-muted-foreground">
          {hasContext
            ? "지금 보고 있는 위치에 페이지가 만들어져요."
            : "페이지를 저장할 위치를 선택해 주세요."}
        </p>
      </div>

      <fieldset className="flex flex-col">
        <legend className="mb-3 text-sm font-medium text-foreground">페이지 유형</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          {templateRegistry.map(({ id, name, tagline, cardIcon: Icon }) => {
            const selected = templateId === id
            return (
              <label
                key={id}
                className={`relative flex h-full cursor-pointer flex-col items-start gap-3 rounded-xl border bg-card p-5 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-indigo-500 ${
                  selected ? "border-indigo-400 ring-1 ring-indigo-400" : "border-border hover:border-indigo-300"
                }`}
              >
                <input
                  type="radio"
                  name="template"
                  value={id}
                  checked={selected}
                  onChange={() => setTemplateId(id)}
                  className="sr-only"
                />
                <span
                  className={`flex size-10 items-center justify-center rounded-lg transition-colors ${
                    selected ? "bg-indigo-600 text-white" : "bg-indigo-50 text-indigo-600"
                  }`}
                >
                  <Icon className="size-5" />
                </span>
                <span className="text-sm font-semibold text-card-foreground">{name}</span>
                <span className="text-pretty text-sm leading-relaxed text-muted-foreground">
                  {tagline}
                </span>
                {selected && (
                  <span className="absolute right-4 top-4 flex size-5 items-center justify-center rounded-full bg-indigo-600 text-white">
                    <Check className="size-3" />
                  </span>
                )}
              </label>
            )
          })}
        </div>
      </fieldset>

      <div className="flex flex-col gap-5 rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="page-title" className="text-sm font-medium text-card-foreground">
            페이지 제목
          </label>
          <input
            id="page-title"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value)
              if (showError) setShowError(false)
            }}
            placeholder="예: 해시 테이블 복습"
            autoFocus
            aria-invalid={showError && titleMissing}
            aria-describedby={showError && titleMissing ? "page-title-error" : undefined}
            className={`${fieldClass} ${showError && titleMissing ? "border-red-400 focus:ring-red-300" : ""}`}
          />
          {showError && titleMissing && (
            <p id="page-title-error" className="text-xs text-red-600">
              페이지 제목을 입력해 주세요.
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <span id="location-label" className="text-sm font-medium text-card-foreground">
            저장 위치
          </span>
          {pickingLocation ? (
            <select
              aria-labelledby="location-label"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className={fieldClass}
            >
              <option value={ROOT}>내 페이지 (최상위)</option>
              {locations.map(({ node, depth }) => (
                <option key={node.id} value={node.id}>
                  {`${"\u00A0\u00A0\u00A0".repeat(depth + 1)}${node.kind === "page" ? "· " : ""}${node.name}${
                    node.kind === "page" ? " (하위 페이지로)" : ""
                  }`}
                </option>
              ))}
            </select>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted/60 px-3 py-2.5">
              <p className="inline-flex min-w-0 items-center gap-1.5 text-sm text-foreground">
                <FolderOpen className="size-4 shrink-0 text-indigo-600" aria-hidden="true" />
                <span className="text-muted-foreground">내 페이지</span>
                {contextPath.map((g, i) => (
                  <span key={g.id} className="inline-flex items-center gap-1.5">
                    <ChevronRight className="size-3 text-muted-foreground" aria-hidden="true" />
                    <span className={i === contextPath.length - 1 ? "font-medium" : "text-muted-foreground"}>
                      {g.name}
                    </span>
                  </span>
                ))}
              </p>
              <button
                type="button"
                onClick={() => setPickingLocation(true)}
                className="text-xs font-medium text-indigo-600 transition-colors hover:text-indigo-800"
              >
                다른 위치에 저장
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
        >
          취소
        </button>
        <button
          type="submit"
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-700"
        >
          페이지 만들기
        </button>
      </div>
    </form>
  )
}
