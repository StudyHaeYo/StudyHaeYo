import { createStore } from "@/lib/create-store"

// Whether the columns behind 오늘 시간표 exist (supabase/migrations/20261112_time_slots.sql):
// todos.start_min and study_records.started_at. Both false until the first load confirms them, so the timetable
// and the time pickers stay hidden instead of flashing in and out, and nothing writes to a missing column.
const store = createStore({ todoTimes: false, recordTimes: false })

export const useTimeSlots = store.useStore

export function setTimeSlots(patch: Partial<{ todoTimes: boolean; recordTimes: boolean }>) {
  store.set((s) => ({ ...s, ...patch }))
}
export const todoTimesReady = () => store.get().todoTimes
export const recordTimesReady = () => store.get().recordTimes
