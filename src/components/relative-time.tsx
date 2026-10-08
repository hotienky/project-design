"use client";

import { useEffect, useState } from "react";

import { formatRelative } from "@/lib/relative-time";

const absolute = (date: Date) =>
  date.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" });

/** Renders a stable UTC timestamp for SSR, then switches to "2 hours ago" once mounted. */
export function RelativeTime({
  value,
  fallback,
}: {
  value: string | Date | null;
  fallback?: string;
}) {
  const date = value === null ? null : new Date(value);
  const [text, setText] = useState<string | null>(null);
  const time = date?.getTime();

  useEffect(() => {
    if (time === undefined) return;
    const update = () => setText(formatRelative(new Date(time)));
    update();
    const timer = setInterval(update, 60_000);
    return () => clearInterval(timer);
  }, [time]);

  if (!date) return <>{fallback ?? "never"}</>;
  return (
    <time dateTime={date.toISOString()} title={absolute(date) + " UTC"} suppressHydrationWarning>
      {text ?? absolute(date)}
    </time>
  );
}
