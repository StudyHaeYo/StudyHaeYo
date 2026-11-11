// 오늘 시간표 (D-38): the arithmetic of the time grid. No imports, so it can be tested on its own.

// A to-do with a time but no length is drawn as one hour.
export const DEFAULT_SLOT_MINUTES = 60
// Shorter than this would not fit a line of text on the grid; a 10-minute to-do is still drawn this tall.
export const MIN_DRAWN_MINUTES = 30

// "13:30". Minutes are from 00:00 of the day.
export function clockLabel(minutes: number) {
  const m = Math.max(0, Math.min(1440, Math.round(minutes)))
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`
}

export const rangeLabel = (start: number, end: number) => `${clockLabel(start)}~${clockLabel(end)}`

// [start, end) of a to-do on the grid: its length, or one hour when none is set, cut at midnight.
export function planRange(startMin: number, durationMin: number | null) {
  return { start: startMin, end: Math.min(1440, startMin + (durationMin && durationMin > 0 ? durationMin : DEFAULT_SLOT_MINUTES)) }
}

export interface Placed {
  lane: number
  // How many lanes share the width where this item sits (its cluster of overlapping items).
  lanes: number
}

// Side by side when times overlap. Items that touch (one ends when the next starts) do not overlap. Each item goes
// in the first lane that is free at its start; items chained by overlaps form a cluster and split its width evenly,
// so a block never covers another and unrelated hours keep the full width.
export function layoutLanes(items: { start: number; end: number }[]): Placed[] {
  const order = items.map((_, i) => i).sort((a, b) => items[a].start - items[b].start || items[b].end - items[a].end || a - b)
  const placed: Placed[] = items.map(() => ({ lane: 0, lanes: 1 }))
  let cluster: number[] = []
  let clusterEnd = -1
  let laneEnds: number[] = []
  const close = () => {
    for (const i of cluster) placed[i].lanes = laneEnds.length
    cluster = []
    laneEnds = []
  }
  for (const i of order) {
    const { start, end } = items[i]
    if (cluster.length > 0 && start >= clusterEnd) close()
    let lane = laneEnds.findIndex((laneEnd) => laneEnd <= start)
    if (lane === -1) lane = laneEnds.length
    laneEnds[lane] = end
    placed[i].lane = lane
    cluster.push(i)
    clusterEnd = Math.max(clusterEnd, end)
  }
  close()
  return placed
}
