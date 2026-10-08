/**
 * Debounce + retry scheduling for autosave, kept free of React and fetch so it can be
 * tested with fake timers. The caller supplies `save`, which reports what happened.
 */
export type SaveOutcome = "saved" | "failed" | "conflict" | "invalid";

export interface AutosaverOptions {
  /** Quiet period after the last change before saving. */
  debounceMs: number;
  /** Delays between retries after a failed save; the last one repeats. */
  retryMs: number[];
  save: () => Promise<SaveOutcome>;
  /** Whether there are unsaved changes (checked after each save). */
  isDirty: () => boolean;
}

export interface Autosaver {
  /** Something changed: (re)start the debounce. */
  notifyChange(): void;
  /** Save immediately (cancels the debounce); resolves when the save settles. */
  saveNow(): Promise<void>;
  /** After a conflict was resolved, allow saving again. */
  resume(): void;
  dispose(): void;
}

export function createAutosaver(options: AutosaverOptions): Autosaver {
  const { debounceMs, retryMs, save, isDirty } = options;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let inFlight: Promise<void> | null = null;
  let changedWhileSaving = false;
  let retries = 0;
  let blocked = false; // a conflict is waiting for the user
  let disposed = false;

  const clear = () => {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
  };
  const schedule = (ms: number) => {
    clear();
    if (disposed || blocked) return;
    timer = setTimeout(() => void run(), ms);
  };

  async function run(): Promise<void> {
    clear();
    if (inFlight) {
      changedWhileSaving = true;
      return inFlight;
    }
    if (disposed || blocked) return;
    inFlight = (async () => {
      let outcome: SaveOutcome;
      try {
        outcome = await save();
      } catch {
        outcome = "failed";
      }
      inFlight = null;
      const again = changedWhileSaving;
      changedWhileSaving = false;
      if (outcome === "saved") {
        retries = 0;
        if (again || isDirty()) schedule(debounceMs);
      } else if (outcome === "failed") {
        schedule(retryMs[Math.min(retries++, retryMs.length - 1)] ?? debounceMs);
      } else if (outcome === "conflict") {
        blocked = true;
      }
      // "invalid": wait for the next change; retrying the same document cannot succeed.
    })();
    return inFlight;
  }

  return {
    notifyChange() {
      if (inFlight) changedWhileSaving = true;
      else schedule(debounceMs);
    },
    saveNow: run,
    resume() {
      blocked = false;
      retries = 0;
      if (isDirty()) schedule(debounceMs);
    },
    dispose() {
      disposed = true;
      clear();
    },
  };
}
