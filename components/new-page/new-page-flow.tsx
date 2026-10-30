"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Check, ChevronRight, FolderOpen } from "lucide-react"
import { getStarter, pageStarters } from "@/lib/templates"
import { addGroup, createPage, flattenTree, nodeExists, nodePath, useWorkspace } from "@/lib/workspace"

const ROOT = "__root__"
const NEW_SUBJECT = "__new_subject__"

export function NewPageFlow({ contextParentId }: { contextParentId?: string }) {
  const router = useRouter()
  const workspace = useWorkspace()
  const locations = flattenTree(workspace)
  const hasContext = nodeExists(workspace, contextParentId)
  const defaultLocation = hasContext ? (contextParentId as string) : ROOT

  const [starterId, setStarterId] = useState(pageStarters[0].id)
  const [title, setTitle] = useState("")
  // Derived, not initial state: on a direct load (/new?parent=…) the workspace arrives after the first
  // render, and a frozen useState default would put the page at the top level instead of in that subject.
  const [pickedLocation, setLocation] = useState<string | null>(null)
  const location = pickedLocation ?? defaultLocation
  const [choosingLocation, setPickingLocation] = useState(false)
  const pickingLocation = choosingLocation || !hasContext
  const [showError, setShowError] = useState(false)
  // "+ 새 과목": name typed here becomes a subject at the top of 내 페이지, then the page goes in it.
  const [newSubject, setNewSubject] = useState<string | null>(null)

  const createSubject = () => {
    const name = newSubject?.trim()
    if (!name) return
    setLocation(addGroup(name, null, "subject"))
    setNewSubject(null)
  }

  const contextPath = hasContext ? nodePath(workspace, contextParentId ?? null) : []
  const titleMissing = title.trim().length === 0

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    if (titleMissing) {
      setShowError(true)
      return
    }
    const id = createPage({ title, starterId, parentId: location === ROOT ? null : location })
    router.push(getStarter(starterId).openAi ? `/record/${id}?ai=1` : `/record/${id}?new=1`)
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
        <legend className="mb-3 text-sm font-medium text-foreground">템플릿</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {pageStarters.map(({ id, name, tagline, icon: Icon }) => {
            const selected = starterId === id
            return (
              <label
                key={id}
                className={`relative flex h-full cursor-pointer flex-col items-start gap-2 rounded-xl border bg-card p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-indigo-500 ${
                  selected ? "border-indigo-400 ring-1 ring-indigo-400" : "border-border hover:border-indigo-300"
                }`}
              >
                <input
                  type="radio"
                  name="template"
                  value={id}
                  checked={selected}
                  onChange={() => setStarterId(id)}
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

      <div className="flex flex-col gap-5 rounded-xl border border-border bg-card p-5">
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
          {pickingLocation && newSubject !== null ? (
            <div className="flex gap-2">
              <input
                autoFocus
                value={newSubject}
                onChange={(e) => setNewSubject(e.target.value)}
                onKeyDown={(e) => {
                  if (e.nativeEvent.isComposing || e.keyCode === 229) return
                  if (e.key === "Enter") {
                    e.preventDefault()
                    createSubject()
                  } else if (e.key === "Escape") {
                    e.preventDefault()
                    setNewSubject(null)
                  }
                }}
                placeholder="새 과목 이름 (예: 운영체제)"
                aria-label="새 과목 이름"
                className={fieldClass}
              />
              <button
                type="button"
                onClick={createSubject}
                disabled={!newSubject.trim()}
                className="shrink-0 rounded-lg bg-indigo-600 px-3 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                만들기
              </button>
              <button
                type="button"
                onClick={() => setNewSubject(null)}
                className="shrink-0 rounded-lg px-3 text-sm text-muted-foreground hover:bg-muted"
              >
                취소
              </button>
            </div>
          ) : pickingLocation ? (
            <select
              aria-labelledby="location-label"
              value={location}
              onChange={(e) => (e.target.value === NEW_SUBJECT ? setNewSubject("") : setLocation(e.target.value))}
              className={fieldClass}
            >
              <option value={ROOT}>내 페이지 (최상위)</option>
              {locations.map(({ node, depth }) => (
                <option key={node.id} value={node.id}>
                  {`${"\u00A0\u00A0\u00A0".repeat(depth + 1)}${node.kind === "page" ? "· " : ""}${node.name}${
                    node.kind === "page" ? " (하위 페이지로)" : node.kind === "subject" ? " · 과목" : ""
                  }`}
                </option>
              ))}
              <option value={NEW_SUBJECT}>+ 새 과목 만들기</option>
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
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
        >
          페이지 만들기
        </button>
      </div>
    </form>
  )
}
