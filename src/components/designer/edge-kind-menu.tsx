"use client";

import { useEffect } from "react";

import { EDGE_KIND_META } from "@/lib/design/catalog";
import type { EdgeKind } from "@/lib/design/schema";

export interface EdgeKindMenuState {
  x: number;
  y: number;
  source: string;
  target: string;
  kinds: EdgeKind[];
}

/** Lets the user pick the kind of a new connection when more than one is allowed. */
export function EdgeKindMenu({
  menu,
  onPick,
  onClose,
}: {
  menu: EdgeKindMenuState;
  onPick: (kind: EdgeKind) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <>
      <div className="fixed inset-0 z-20" onPointerDown={onClose} aria-hidden />
      <div
        role="menu"
        aria-label="Connection kind"
        className="absolute z-30 w-64 rounded-lg border bg-popover p-1 text-popover-foreground shadow-md"
        style={{ left: menu.x, top: menu.y }}
      >
        <p className="px-2 py-1 text-xs text-muted-foreground">Connect as…</p>
        {menu.kinds.map((kind) => (
          <button
            key={kind}
            role="menuitem"
            type="button"
            autoFocus={kind === menu.kinds[0]}
            className="flex w-full flex-col rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
            onClick={() => onPick(kind)}
          >
            <span className="font-medium">{EDGE_KIND_META[kind].label}</span>
            <span className="text-xs text-muted-foreground">
              {EDGE_KIND_META[kind].description}
            </span>
          </button>
        ))}
      </div>
    </>
  );
}
