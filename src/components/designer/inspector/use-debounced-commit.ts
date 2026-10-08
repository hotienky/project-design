"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Local edit state for a text-like control. Typing never touches the store (which would make
 * every keystroke an undo step); the value is committed on blur, on Enter (`flush`), or `delay`
 * ms after the last keystroke, and a pending edit is flushed when the control unmounts. An
 * invalid value (per `validate`) is shown with its message and never committed.
 */
export function useDebouncedCommit<T>(
  value: T,
  commit: (value: T) => void,
  options: { delay?: number; validate?: (value: T) => string | null } = {},
) {
  const { delay = 600, validate } = options;
  const [edit, setEdit] = useState<{ value: T } | null>(null);
  const pending = useRef<{ value: T } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const latest = useRef({ commit, validate });
  useEffect(() => {
    latest.current = { commit, validate };
  });

  const flush = useCallback(() => {
    clearTimeout(timer.current);
    const current = pending.current;
    if (!current) return;
    if (latest.current.validate?.(current.value)) return; // keep the invalid text on screen
    pending.current = null;
    setEdit(null);
    latest.current.commit(current.value);
  }, []);

  const setValue = useCallback(
    (next: T) => {
      pending.current = { value: next };
      setEdit({ value: next });
      clearTimeout(timer.current);
      timer.current = setTimeout(flush, delay);
    },
    [flush, delay],
  );

  useEffect(() => () => flush(), [flush]);

  const shown = edit ? edit.value : value;
  const error = edit && validate ? validate(edit.value) : null;
  return { value: shown, setValue, flush, error };
}
