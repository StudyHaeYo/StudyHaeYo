import { useSyncExternalStore } from "react"

// In-memory stand-in for a backend: state survives client-side navigation within a session.
// The server snapshot is always the seed, so SSR and hydration markup match.
export function createStore<T>(initial: T) {
  let state = initial
  const listeners = new Set<() => void>()

  const subscribe = (listener: () => void) => {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }

  return {
    get: () => state,
    set(update: (prev: T) => T) {
      state = update(state)
      for (const listener of listeners) listener()
    },
    useStore(): T {
      return useSyncExternalStore(
        subscribe,
        () => state,
        () => initial,
      )
    },
  }
}
