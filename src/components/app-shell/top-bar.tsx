import { Network } from "lucide-react";
import Link from "next/link";

import { ThemeToggle } from "@/components/app-shell/theme-toggle";

export function TopBar() {
  return (
    <header className="flex h-12 shrink-0 items-center gap-6 border-b bg-background px-4">
      <Link href="/" className="flex items-center gap-2 font-heading text-sm font-semibold">
        <span className="grid size-7 place-items-center rounded-lg bg-primary text-primary-foreground">
          <Network className="size-4" aria-hidden />
        </span>
        Project Design
      </Link>
      <nav aria-label="Main" className="flex items-center gap-1 text-sm text-muted-foreground">
        <Link href="/" className="rounded-md px-2.5 py-1 hover:bg-muted hover:text-foreground">
          Projects
        </Link>
        <Link
          href="/settings"
          className="rounded-md px-2.5 py-1 hover:bg-muted hover:text-foreground"
        >
          Settings
        </Link>
      </nav>
      <div className="ml-auto">
        <ThemeToggle />
      </div>
    </header>
  );
}
