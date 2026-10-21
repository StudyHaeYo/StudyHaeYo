import { createStore } from "@/lib/create-store"
import { check, db, enqueueWrite } from "@/lib/db/queue"
import { newId, todoInsertRow } from "@/lib/db/rows"
import { toISODate } from "@/lib/study-pages"

// 오늘의 체크리스트. The signed-in user's todos live in Supabase (todos); this store is the screen cache, filled by
// lib/db/sync.ts after sign-in. Components call these functions, never the DB.
export interface Todo {
  id: string
  title: string
  dueOn: string // local date the todo is for
  doneAt: number | null // ms; null = not done
  position: number
}

// "unavailable": the todos table could not be read (not created yet). The rest of the app still works.
export type TodosStatus = "loading" | "ready" | "unavailable"

const store = createStore<Todo[]>([])
const statusStore = createStore<TodosStatus>("loading")

export const useTodos = store.useStore
export const useTodosStatus = statusStore.useStore

export function replaceTodos(todos: Todo[], status: TodosStatus) {
  store.set(() => todos)
  statusStore.set(() => status)
}

// Today's list: todos due today, plus older ones not done yet (they carry over), plus ones finished today.
// Something finished on an earlier day drops off. Order: not done first, then by position.
export function todayChecklist(todos: Todo[], today: string) {
  return todos
    .filter((t) => t.dueOn <= today && (t.doneAt === null || toISODate(new Date(t.doneAt)) === today))
    .sort((a, b) => Number(a.doneAt !== null) - Number(b.doneAt !== null) || a.position - b.position)
}

export function addTodo(title: string, today: string) {
  const text = title.trim().slice(0, 200)
  if (!text) return
  const todos = store.get()
  const todo: Todo = {
    id: newId(),
    title: text,
    dueOn: today,
    doneAt: null,
    position: todos.reduce((max, t) => Math.max(max, t.position), -1) + 1,
  }
  store.set((list) => [...list, todo])
  enqueueWrite(async (userId) => {
    check(await db().from("todos").insert(todoInsertRow(todo, userId)).select("id"), 1)
  })
}

function patchTodo(id: string, patch: Partial<Todo>, row: Record<string, unknown>) {
  if (!store.get().some((t) => t.id === id)) return
  store.set((list) => list.map((t) => (t.id === id ? { ...t, ...patch } : t)))
  enqueueWrite(async (userId) => {
    check(await db().from("todos").update(row).eq("id", id).eq("user_id", userId).select("id"), 1)
  })
}

export function toggleTodo(id: string) {
  const todo = store.get().find((t) => t.id === id)
  if (!todo) return
  const doneAt = todo.doneAt === null ? Date.now() : null
  patchTodo(id, { doneAt }, { done_at: doneAt === null ? null : new Date(doneAt).toISOString() })
}

export function renameTodo(id: string, title: string) {
  const text = title.trim().slice(0, 200)
  if (!text) return
  patchTodo(id, { title: text }, { title: text })
}

export function removeTodo(id: string) {
  if (!store.get().some((t) => t.id === id)) return
  store.set((list) => list.filter((t) => t.id !== id))
  enqueueWrite(async (userId) => {
    check(await db().from("todos").delete().eq("id", id).eq("user_id", userId).select("id"), 1)
  })
}
