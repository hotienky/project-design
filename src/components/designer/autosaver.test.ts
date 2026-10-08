import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createAutosaver, type SaveOutcome } from "@/components/designer/autosaver";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

function setup(outcomes: SaveOutcome[], dirtyAfter = false) {
  const save = vi.fn(async () => outcomes.shift() ?? "saved");
  let dirty = dirtyAfter;
  const saver = createAutosaver({
    debounceMs: 800,
    retryMs: [2000, 4000, 8000],
    save,
    isDirty: () => dirty,
  });
  return { save, saver, setDirty: (v: boolean) => (dirty = v) };
}

describe("createAutosaver", () => {
  it("collapses a burst of changes into one save after the quiet period", async () => {
    const { save, saver } = setup(["saved"]);
    saver.notifyChange();
    await vi.advanceTimersByTimeAsync(500);
    saver.notifyChange();
    await vi.advanceTimersByTimeAsync(500);
    expect(save).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(300);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("saveNow cancels the debounce and saves immediately", async () => {
    const { save, saver } = setup(["saved"]);
    saver.notifyChange();
    await saver.saveNow();
    expect(save).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(5000);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("never overlaps saves and saves again for edits made meanwhile", async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    let calls = 0;
    const saver = createAutosaver({
      debounceMs: 800,
      retryMs: [1000],
      isDirty: () => false,
      save: async () => {
        calls++;
        if (calls === 1) await gate;
        return "saved";
      },
    });
    saver.notifyChange();
    await vi.advanceTimersByTimeAsync(800);
    expect(calls).toBe(1);
    saver.notifyChange(); // edit while the first save is in flight
    await vi.advanceTimersByTimeAsync(2000);
    expect(calls).toBe(1);
    release();
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(800);
    expect(calls).toBe(2);
  });

  it("retries failures with growing delays, repeating the last", async () => {
    const { save, saver } = setup(["failed", "failed", "failed", "failed", "saved"]);
    saver.notifyChange();
    await vi.advanceTimersByTimeAsync(800); // 1st attempt
    expect(save).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1999);
    expect(save).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1); // +2s
    expect(save).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(4000);
    expect(save).toHaveBeenCalledTimes(3);
    await vi.advanceTimersByTimeAsync(8000);
    expect(save).toHaveBeenCalledTimes(4);
    await vi.advanceTimersByTimeAsync(8000); // last delay repeats
    expect(save).toHaveBeenCalledTimes(5);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(save).toHaveBeenCalledTimes(5);
  });

  it("stops after a conflict until resumed", async () => {
    const { save, saver, setDirty } = setup(["conflict", "saved"]);
    saver.notifyChange();
    await vi.advanceTimersByTimeAsync(800);
    expect(save).toHaveBeenCalledTimes(1);
    saver.notifyChange();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(save).toHaveBeenCalledTimes(1);
    setDirty(true);
    saver.resume();
    await vi.advanceTimersByTimeAsync(800);
    expect(save).toHaveBeenCalledTimes(2);
  });

  it("does not retry an invalid document, but saves again on the next change", async () => {
    const { save, saver } = setup(["invalid", "saved"]);
    saver.notifyChange();
    await vi.advanceTimersByTimeAsync(800);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(save).toHaveBeenCalledTimes(1);
    saver.notifyChange();
    await vi.advanceTimersByTimeAsync(800);
    expect(save).toHaveBeenCalledTimes(2);
  });

  it("stops everything once disposed", async () => {
    const { save, saver } = setup(["saved"]);
    saver.notifyChange();
    saver.dispose();
    await vi.advanceTimersByTimeAsync(5000);
    expect(save).not.toHaveBeenCalled();
  });
});
