"use client"

import { useState, type FormEvent } from "react"
import { Check, Plus, X } from "lucide-react"
import { useTodayISO } from "@/hooks/use-today"
import { addTodo, removeTodo, renameTodo, todayChecklist, toggleTodo, useTodos, useTodosStatus, type Todo } from "@/lib/todos"

function useChecklist() {
  const todos = useTodos()
  const status = useTodosStatus()
  const today = useTodayISO()
  const items = today ? todayChecklist(todos, today) : []
  return { status, today, items, ready: status === "ready" && today !== null }
}

// 오늘의 체크리스트: today's todos plus unfinished ones from earlier days (lib/todos.ts todayChecklist).
// The list and the add field; the home "오늘" card embeds this, ChecklistWidget wraps it in its own card.
export function ChecklistBody() {
  const { status, today, items, ready } = useChecklist()
  const [draft, setDraft] = useState("")

  const handleAdd = (e: FormEvent) => {
    e.preventDefault()
    if (!today || !draft.trim()) return
    addTodo(draft, today)
    setDraft("")
  }

  if (status === "unavailable") {
    return <p className="px-2 py-1 text-xs leading-relaxed text-muted-foreground">할 일을 저장할 곳을 준비하고 있어요.</p>
  }
  if (!ready || today === null) return <div className="h-10" aria-hidden="true" />

  return (
    <>
      {items.length === 0 ? (
        <p className="px-2 pb-1 text-xs leading-relaxed text-muted-foreground">
          오늘 할 일을 적어 두세요. 못 끝낸 일은 다음 날에도 보여요.
        </p>
      ) : (
        <ul className="mb-1 space-y-0.5">
          {items.map((todo) => (
            <TodoRow key={todo.id} todo={todo} today={today} />
          ))}
        </ul>
      )}

      <form onSubmit={handleAdd} className="flex items-center gap-1.5 px-1">
        <Plus className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={200}
          placeholder="할 일 추가"
          aria-label="할 일 추가"
          className="min-w-0 flex-1 rounded-md bg-transparent px-1.5 py-1.5 text-sm text-foreground outline-none placeholder:text-muted-foreground/60 focus:bg-muted/50"
        />
      </form>
    </>
  )
}

export function useChecklistCount() {
  const { status, items, ready } = useChecklist()
  if (status === "unavailable") return "준비 중"
  if (!ready || items.length === 0) return null
  return `${items.filter((t) => t.doneAt !== null).length}/${items.length}`
}

function TodoRow({ todo, today }: { todo: Todo; today: string }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(todo.title)
  const done = todo.doneAt !== null
  const carried = !done && todo.dueOn < today

  const commit = () => {
    if (draft.trim() && draft.trim() !== todo.title) renameTodo(todo.id, draft)
    else setDraft(todo.title)
    setEditing(false)
  }

  return (
    <li className="group flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-accent">
      <button
        type="button"
        role="checkbox"
        aria-checked={done}
        aria-label={`${todo.title} ${done ? "완료 취소" : "완료"}`}
        onClick={() => toggleTodo(todo.id)}
        className={`flex size-5 shrink-0 items-center justify-center rounded-md border transition-[colors,transform] active:scale-90 ${
          done ? "border-indigo-600 bg-indigo-600 text-white" : "border-border bg-background hover:border-indigo-400"
        }`}
      >
        {done && <Check className="size-3.5 animate-in zoom-in-50 duration-150" />}
      </button>

      {editing ? (
        <input
          autoFocus
          value={draft}
          maxLength={200}
          aria-label="할 일 이름"
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.nativeEvent.isComposing || e.keyCode === 229) return
            if (e.key === "Enter") commit()
            if (e.key === "Escape") {
              setDraft(todo.title)
              setEditing(false)
            }
          }}
          className="min-w-0 flex-1 rounded border border-indigo-300 bg-card px-1.5 py-0.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-indigo-200"
        />
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          title="눌러서 이름 바꾸기"
          className={`min-w-0 flex-1 truncate text-left text-sm transition-colors ${
            done ? "text-muted-foreground line-through" : "text-foreground"
          }`}
        >
          {todo.title}
        </button>
      )}

      {carried && !editing && (
        <span className="shrink-0 text-xs text-amber-600" title="전날에 못 끝내서 넘어온 할 일">
          이월
        </span>
      )}
      {!editing && (
        <button
          type="button"
          onClick={() => removeTodo(todo.id)}
          aria-label={`${todo.title} 삭제`}
          className="flex size-6 shrink-0 items-center justify-center rounded text-muted-foreground opacity-0 [@media(hover:none)]:opacity-100 transition-opacity hover:bg-background hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
        >
          <X className="size-3.5" />
        </button>
      )}
    </li>
  )
}
