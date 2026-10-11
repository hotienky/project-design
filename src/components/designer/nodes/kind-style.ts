import {
  Box,
  Cable,
  Circle,
  Cog,
  CircleCheck,
  CircleDashed,
  CircleX,
  Database,
  Gem,
  Layers,
  Plug,
  Puzzle,
  Repeat,
  StickyNote,
  Table2,
  TableProperties,
  User,
  Zap,
  Waypoints,
  type LucideIcon,
} from "lucide-react";

import type { NodeKind } from "@/lib/design/schema";
import type { ComponentStatus } from "@/lib/design/status";

/**
 * Class strings are written out in full so Tailwind can see them. `line` and `tint` draw
 * container outlines and fills; `text` tints the kind icon; `hex` colours the minimap.
 */
export const KIND_STYLE: Record<
  NodeKind,
  { icon: LucideIcon; line: string; text: string; tint: string; hex: string }
> = {
  service: {
    icon: Box,
    line: "border-indigo-500/30",
    text: "text-indigo-500",
    tint: "bg-indigo-500/5",
    hex: "#6366f1",
  },
  layer: {
    icon: Layers,
    line: "border-slate-500/30",
    text: "text-slate-500",
    tint: "bg-slate-500/5",
    hex: "#64748b",
  },
  module: {
    icon: Puzzle,
    line: "border-sky-500/30",
    text: "text-sky-500",
    tint: "bg-sky-500/5",
    hex: "#0ea5e9",
  },
  entity: {
    icon: Table2,
    line: "border-amber-500/30",
    text: "text-amber-500",
    tint: "bg-amber-500/5",
    hex: "#f59e0b",
  },
  datastore: {
    icon: Database,
    line: "border-emerald-500/30",
    text: "text-emerald-500",
    tint: "bg-emerald-500/5",
    hex: "#10b981",
  },
  api: {
    icon: Plug,
    line: "border-violet-500/30",
    text: "text-violet-500",
    tint: "bg-violet-500/5",
    hex: "#8b5cf6",
  },
  integration: {
    icon: Cable,
    line: "border-pink-500/30",
    text: "text-pink-500",
    tint: "bg-pink-500/5",
    hex: "#ec4899",
  },
  queue: {
    icon: Waypoints,
    line: "border-orange-500/30",
    text: "text-orange-500",
    tint: "bg-orange-500/5",
    hex: "#f97316",
  },
  actor: {
    icon: User,
    line: "border-teal-500/30",
    text: "text-teal-500",
    tint: "bg-teal-500/5",
    hex: "#14b8a6",
  },
  note: {
    icon: StickyNote,
    line: "border-yellow-500/30",
    text: "text-yellow-600",
    tint: "bg-yellow-500/5",
    hex: "#eab308",
  },
  loop: {
    icon: Repeat,
    line: "border-rose-500/30",
    text: "text-rose-500",
    tint: "bg-rose-500/5",
    hex: "#f43f5e",
  },
  system: {
    icon: Cog,
    line: "border-fuchsia-500/30",
    text: "text-fuchsia-500",
    tint: "bg-fuchsia-500/5",
    hex: "#d946ef",
  },
  mechanic: {
    icon: Zap,
    line: "border-cyan-500/30",
    text: "text-cyan-500",
    tint: "bg-cyan-500/5",
    hex: "#06b6d4",
  },
  resource: {
    icon: Gem,
    line: "border-lime-500/30",
    text: "text-lime-600",
    tint: "bg-lime-500/5",
    hex: "#84cc16",
  },
  content: {
    icon: TableProperties,
    line: "border-stone-500/30",
    text: "text-stone-500",
    tint: "bg-stone-500/5",
    hex: "#78716c",
  },
};

/** `chip` is the outlined pill shown on canvas cards; `badge` the filled one in the inspector. */
export const STATUS_STYLE: Record<
  ComponentStatus,
  { label: string; icon: LucideIcon; chip: string; badge: string }
> = {
  todo: {
    label: "To do",
    icon: Circle,
    chip: "border-gray-400/50 text-gray-600 dark:text-gray-300",
    badge: "bg-gray-500/15 text-gray-600 dark:text-gray-300",
  },
  in_progress: {
    label: "In progress",
    icon: CircleDashed,
    chip: "border-blue-500/50 text-blue-600 dark:text-blue-300",
    badge: "bg-blue-500/15 text-blue-600 dark:text-blue-300",
  },
  done: {
    label: "Done",
    icon: CircleCheck,
    chip: "border-green-500/50 text-green-600 dark:text-green-300",
    badge: "bg-green-500/15 text-green-600 dark:text-green-300",
  },
  blocked: {
    label: "Blocked",
    icon: CircleX,
    chip: "border-red-500/50 text-red-600 dark:text-red-300",
    badge: "bg-red-500/15 text-red-600 dark:text-red-300",
  },
};

export const NOTE_COLORS = {
  yellow: "bg-yellow-200 text-yellow-950 dark:bg-yellow-300/90",
  blue: "bg-sky-200 text-sky-950 dark:bg-sky-300/90",
  green: "bg-green-200 text-green-950 dark:bg-green-300/90",
  pink: "bg-pink-200 text-pink-950 dark:bg-pink-300/90",
  gray: "bg-gray-200 text-gray-950 dark:bg-gray-300/90",
} as const;
