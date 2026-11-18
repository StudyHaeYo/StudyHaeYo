// One look for the things every screen shares (2026-11-18, UI 점검: buttons came in 11~14 looks a screen, radii in 12,
// shadows in 5, and nothing moved when pressed or opened). Only tailwind-merge is imported, so server and client
// components can both use it.
//
// Sizes: text 12 (captions) · 14 (body, controls) · 16 (note body) · 18 (section titles) · 24 (page titles).
// Corners: rounded-lg (10px) for controls, rounded-xl (14px) for boxes · menus · dialogs, rounded-full for pills.
// Motion (emil-design-eng): a press scales to 0.97; menus and dialogs fade and grow from 95% in 150ms ease-out.
// Nothing animates for keyboard shortcuts (Ctrl K opens at once) and everything stops under reduced motion.

import { twMerge } from "tailwind-merge"

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger"
export type ButtonSize = "md" | "sm" | "icon" | "icon-sm"

const buttonBase =
  "inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg font-medium select-none transition-[color,background-color,border-color,transform] duration-150 ease-out active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action-500 disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none motion-reduce:active:scale-100 [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"

const buttonSizes: Record<ButtonSize, string> = {
  md: "h-9 px-3.5 text-sm",
  sm: "h-8 px-3 text-sm",
  icon: "size-9",
  "icon-sm": "size-8",
}

const buttonVariants: Record<ButtonVariant, string> = {
  // The screen's main action, at most one per screen or dialog.
  primary: "bg-action-600 text-action-foreground hover:bg-action-700",
  // Everything else that is a button.
  secondary: "border border-border bg-background text-foreground hover:bg-accent",
  // Tools in a bar (기록, AI, ⋯) and actions inside a list.
  ghost: "text-muted-foreground hover:bg-accent hover:text-foreground aria-expanded:bg-accent aria-expanded:text-foreground",
  // Deleting: a soft red, loud enough to read as "this removes something" next to a primary button.
  danger: "bg-danger-50 text-danger-700 hover:bg-danger-100",
}

// `extra` is merged, not appended: `button("secondary", "sm", "rounded-full")` gives a pill, not two radii.
export function button(variant: ButtonVariant = "secondary", size: ButtonSize = "md", extra?: string) {
  return twMerge(buttonBase, buttonSizes[size], buttonVariants[variant], extra)
}

// Menus and popovers (anchored to a trigger) and dialogs (centered). Same corner and border; dialogs sit higher.
const enter = "animate-in fade-in-0 zoom-in-95 duration-150 ease-out motion-reduce:animate-none"
export const menuPanel = `rounded-xl border border-border bg-popover text-popover-foreground shadow-lg ${enter}`
export const dialogPanel = `rounded-xl border border-border bg-card text-card-foreground shadow-xl ${enter}`
export const dialogBackdrop = "animate-in fade-in-0 duration-150 motion-reduce:animate-none"
