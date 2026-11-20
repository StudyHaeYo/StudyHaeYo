import { createStore } from "@/lib/create-store"
import { check, db, enqueueWrite } from "@/lib/db/queue"
import { ddayInsertRow, newId } from "@/lib/db/rows"
import { daysBetween } from "@/lib/study-pages"

// D-day: a day the user names themselves (an exam, a deadline). Stored in Supabase (ddays); this store is the screen
// cache, filled by lib/db/sync.ts after sign-in. Components call these functions, never the DB.
export interface Dday {
  id: string
  title: string
  date: string // local date, YYYY-MM-DD
}

// "unavailable": the ddays table could not be read (its SQL not run yet). The D-day parts of the screen stay hidden.
export type DdaysStatus = "loading" | "ready" | "unavailable"

const store = createStore<Dday[]>([])
const statusStore = createStore<DdaysStatus>("loading")

export const useDdays = store.useStore
export const useDdaysStatus = statusStore.useStore

export function replaceDdays(ddays: Dday[], status: DdaysStatus) {
  store.set(() => ddays)
  statusStore.set(() => status)
}

export const DDAY_TITLE_MAX = 40

export function addDday(title: string, date: string) {
  const text = title.trim().slice(0, DDAY_TITLE_MAX)
  if (!text || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return
  const dday: Dday = { id: newId(), title: text, date }
  store.set((list) => [...list, dday])
  enqueueWrite(async (userId) => {
    check(await db().from("ddays").insert(ddayInsertRow(dday, userId)).select("id"), 1)
  })
}

export function removeDday(id: string) {
  if (!store.get().some((d) => d.id === id)) return
  store.set((list) => list.filter((d) => d.id !== id))
  enqueueWrite(async (userId) => {
    check(await db().from("ddays").delete().eq("id", id).eq("user_id", userId).select("id"), 1)
  })
}

// 되돌리기 after a delete: the same D-day back (same id).
export function restoreDday(dday: Dday) {
  if (store.get().some((d) => d.id === dday.id)) return
  store.set((list) => [...list, dday])
  enqueueWrite(async (userId) => {
    check(await db().from("ddays").insert(ddayInsertRow(dday, userId)).select("id"), 1)
  })
}

// "D-12", "D-day" on the day, "D+3" after it.
export function ddayLabel(date: string, today: string) {
  const days = daysBetween(today, date)
  return days === 0 ? "D-day" : days > 0 ? `D-${days}` : `D+${-days}`
}

// Today and later, nearest first (same day: by name).
export function upcomingDdays(ddays: Dday[], today: string) {
  return ddays
    .filter((d) => d.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title))
}

// Past ones, most recent first, for the list under the month (kept until deleted).
export function pastDdays(ddays: Dday[], today: string) {
  return ddays.filter((d) => d.date < today).sort((a, b) => b.date.localeCompare(a.date))
}
