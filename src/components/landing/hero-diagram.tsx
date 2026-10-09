"use client";

import { Box, Check, Database, Globe, Plug, Waypoints, type LucideIcon } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";

// Positions are percentages of the 600×340 stage so the diagram scales with its box.
const NODES: {
  id: string;
  label: string;
  meta: string;
  icon: LucideIcon;
  color: string;
  x: number;
  y: number;
}[] = [
  { id: "web", label: "Web app", meta: "next.js", icon: Globe, color: "#0ea5e9", x: 2, y: 8 },
  { id: "api", label: "API service", meta: "rest /v1", icon: Box, color: "#6366f1", x: 37, y: 40 },
  {
    id: "db",
    label: "Postgres",
    meta: "3 entities",
    icon: Database,
    color: "#10b981",
    x: 72,
    y: 8,
  },
  { id: "queue", label: "Events", meta: "redis", icon: Waypoints, color: "#f59e0b", x: 72, y: 72 },
  { id: "mail", label: "Resend", meta: "email", icon: Plug, color: "#f43f5e", x: 2, y: 72 },
];

// Edges as SVG paths in the 600×340 viewBox, from the side of one node to the next.
const EDGES = [
  { d: "M 168 50 C 200 50, 190 158, 222 158", color: "#6366f1" },
  { d: "M 378 158 C 410 158, 400 50, 432 50", color: "#10b981" },
  { d: "M 378 168 C 410 168, 400 266, 432 266", color: "#f59e0b" },
  { d: "M 222 168 C 190 168, 200 266, 168 266", color: "#f43f5e" },
];

const AGENT_STEPS = [
  { call: "get_project_brief", result: "21 components" },
  { call: "get_build_plan", result: "6 steps" },
  { call: "set_component_status api", result: "done" },
];

/** The hero's live mini-canvas: nodes pop in, edges draw, packets flow, an agent reports back. */
export function HeroDiagram() {
  const reduce = useReducedMotion();
  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="relative aspect-[600/340] w-full">
        <svg viewBox="0 0 600 340" className="absolute inset-0 size-full" aria-hidden>
          {EDGES.map((edge, i) => (
            <g key={edge.d}>
              <motion.path
                d={edge.d}
                fill="none"
                stroke={edge.color}
                strokeOpacity={0.55}
                strokeWidth={2}
                strokeDasharray="1 0"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ delay: 0.6 + i * 0.15, duration: 0.8, ease: "easeInOut" }}
              />
              {!reduce && (
                <motion.circle
                  r={3.5}
                  fill={edge.color}
                  style={{ offsetPath: `path("${edge.d}")` }}
                  initial={{ offsetDistance: "0%", opacity: 0 }}
                  animate={{ offsetDistance: "100%", opacity: [0, 1, 1, 0] }}
                  transition={{
                    delay: 1.6 + i * 0.45,
                    duration: 1.8,
                    repeat: Infinity,
                    repeatDelay: 1.2,
                    ease: "easeInOut",
                  }}
                />
              )}
            </g>
          ))}
        </svg>

        {NODES.map((node, i) => {
          const Icon = node.icon;
          return (
            <motion.div
              key={node.id}
              className="absolute flex w-[28%] items-center gap-2 rounded-xl border bg-card/90 px-2 py-1.5 sm:px-2.5 sm:py-2 shadow-sm backdrop-blur"
              style={{ left: `${node.x}%`, top: `${node.y}%` }}
              initial={{ opacity: 0, scale: 0.8, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ delay: 0.15 + i * 0.1, type: "spring", stiffness: 260, damping: 20 }}
              whileHover={{ y: -3, scale: 1.04 }}
            >
              <span
                className="hidden size-7 shrink-0 place-items-center rounded-lg sm:grid"
                style={{ backgroundColor: `${node.color}1a`, color: node.color }}
              >
                <Icon className="size-4" aria-hidden />
              </span>
              <span className="min-w-0 leading-tight">
                <span className="block truncate text-xs font-medium">{node.label}</span>
                <span className="hidden truncate font-mono sm:block text-[10px] text-muted-foreground">
                  {node.meta}
                </span>
              </span>
            </motion.div>
          );
        })}
      </div>
      <AgentCard />
    </div>
  );
}

/** A terminal-like card that "runs" MCP tool calls one after another, then loops. */
function AgentCard() {
  const reduce = useReducedMotion();
  const [step, setStep] = useState(reduce ? AGENT_STEPS.length : 0);

  useEffect(() => {
    if (reduce) return;
    const timer = setInterval(
      () => setStep((s) => (s >= AGENT_STEPS.length + 2 ? 0 : s + 1)),
      1100,
    );
    return () => clearInterval(timer);
  }, [reduce]);

  return (
    <motion.div
      className="mt-6 rounded-xl border bg-zinc-950 p-3 font-mono text-[11px] text-zinc-300 shadow-xl sm:ml-auto sm:w-[70%] sm:-mr-10"
      initial={{ opacity: 0, y: 24, rotate: -2 }}
      animate={{ opacity: 1, y: 0, rotate: 0 }}
      transition={{ delay: 1.2, type: "spring", stiffness: 140, damping: 18 }}
    >
      <div className="mb-2 flex items-center gap-1.5">
        <span className="size-2 rounded-full bg-rose-500/80" />
        <span className="size-2 rounded-full bg-amber-500/80" />
        <span className="size-2 rounded-full bg-emerald-500/80" />
        <span className="ml-2 text-[10px] text-zinc-500">agent · /api/mcp</span>
      </div>
      <ul className="grid gap-1">
        {AGENT_STEPS.map((s, i) => (
          <motion.li
            key={s.call}
            className="flex items-center gap-2"
            initial={false}
            animate={{ opacity: step > i ? 1 : 0.25 }}
            transition={{ duration: 0.3 }}
          >
            <span className="text-emerald-400">❯</span>
            <span className="truncate">{s.call}</span>
            <motion.span
              className="ml-auto flex items-center gap-1 text-emerald-400"
              initial={false}
              animate={{ opacity: step > i ? 1 : 0, x: step > i ? 0 : -4 }}
            >
              <Check className="size-3" aria-hidden />
              {s.result}
            </motion.span>
          </motion.li>
        ))}
      </ul>
    </motion.div>
  );
}
