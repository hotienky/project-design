import {
  Box,
  Cable,
  Database,
  Layers,
  Plug,
  Puzzle,
  StickyNote,
  Table2,
  User,
  Waypoints,
  type LucideIcon,
} from "lucide-react";

import type { NodeKind } from "@/lib/design/schema";
import type { ComponentStatus } from "@/lib/design/status";

/** Class strings are written out in full so Tailwind can see them. */
export const KIND_STYLE: Record<
  NodeKind,
  { icon: LucideIcon; border: string; text: string; tint: string; hex: string }
> = {
  service: {
    icon: Box,
    border: "border-l-indigo-500",
    text: "text-indigo-500",
    tint: "bg-indigo-500/5",
    hex: "#6366f1",
  },
  layer: {
    icon: Layers,
    border: "border-l-slate-500",
    text: "text-slate-500",
    tint: "bg-slate-500/5",
    hex: "#64748b",
  },
  module: {
    icon: Puzzle,
    border: "border-l-sky-500",
    text: "text-sky-500",
    tint: "bg-sky-500/5",
    hex: "#0ea5e9",
  },
  entity: {
    icon: Table2,
    border: "border-l-amber-500",
    text: "text-amber-500",
    tint: "bg-amber-500/5",
    hex: "#f59e0b",
  },
  datastore: {
    icon: Database,
    border: "border-l-emerald-500",
    text: "text-emerald-500",
    tint: "bg-emerald-500/5",
    hex: "#10b981",
  },
  api: {
    icon: Plug,
    border: "border-l-violet-500",
    text: "text-violet-500",
    tint: "bg-violet-500/5",
    hex: "#8b5cf6",
  },
  integration: {
    icon: Cable,
    border: "border-l-pink-500",
    text: "text-pink-500",
    tint: "bg-pink-500/5",
    hex: "#ec4899",
  },
  queue: {
    icon: Waypoints,
    border: "border-l-orange-500",
    text: "text-orange-500",
    tint: "bg-orange-500/5",
    hex: "#f97316",
  },
  actor: {
    icon: User,
    border: "border-l-teal-500",
    text: "text-teal-500",
    tint: "bg-teal-500/5",
    hex: "#14b8a6",
  },
  note: {
    icon: StickyNote,
    border: "border-l-yellow-500",
    text: "text-yellow-600",
    tint: "bg-yellow-500/5",
    hex: "#eab308",
  },
};

export const STATUS_STYLE: Record<ComponentStatus, { label: string; dot: string; badge: string }> =
  {
    todo: {
      label: "To do",
      dot: "bg-gray-400",
      badge: "bg-gray-500/15 text-gray-600 dark:text-gray-300",
    },
    in_progress: {
      label: "In progress",
      dot: "bg-blue-500",
      badge: "bg-blue-500/15 text-blue-600 dark:text-blue-300",
    },
    done: {
      label: "Done",
      dot: "bg-green-500",
      badge: "bg-green-500/15 text-green-600 dark:text-green-300",
    },
    blocked: {
      label: "Blocked",
      dot: "bg-red-500",
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
