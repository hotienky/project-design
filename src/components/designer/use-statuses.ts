"use client";

import { useEffect } from "react";

import { useStatusStore, type StatusEntry } from "@/stores/status-store";

const POLL_MS = 10_000;

/** Polls agent-reported statuses while the tab is visible and returns the latest. */
export function useStatuses(slug: string) {
  useEffect(() => {
    useStatusStore.getState().replace(slug, {});
    let stopped = false;

    async function load() {
      try {
        const response = await fetch(`/api/projects/${slug}/status`, { cache: "no-store" });
        if (!response.ok || stopped) return;
        const body = (await response.json()) as { statuses: never };
        useStatusStore.getState().replace(slug, body.statuses);
      } catch {
        // Offline or the server restarted: keep the last statuses and try again.
      }
    }
    const tick = () => {
      if (document.visibilityState === "visible") void load();
    };
    void load();
    const timer = setInterval(tick, POLL_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      stopped = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [slug]);

  return useStatusStore((s) => (s.slug === slug ? s.statuses : EMPTY));
}

const EMPTY: Record<string, StatusEntry> = {};
