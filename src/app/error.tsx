"use client";

import { Button } from "@/components/ui/button";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-col items-center gap-3 p-16 text-center">
      <h1 className="font-heading text-lg font-semibold">Something went wrong</h1>
      <p className="text-sm text-muted-foreground">
        The page could not be loaded. If the database is unreachable, check that it is running.
      </p>
      <Button onClick={reset}>Retry</Button>
    </main>
  );
}
