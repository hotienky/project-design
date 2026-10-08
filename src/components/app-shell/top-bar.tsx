import { Network } from "lucide-react";
import Link from "next/link";

import { ThemeToggle } from "@/components/app-shell/theme-toggle";

export function TopBar() {
  return (
    <header className="flex h-12 shrink-0 items-center gap-6 border-b bg-background px-4">
      <Link href="/" className="flex items-center gap-2 font-heading font-semibold">
        <Network className="size-4" aria-hidden />
        Project Design
      </Link>
      <nav aria-label="Main" className="flex items-center gap-4 text-sm text-muted-foreground">
        <Link href="/" className="hover:text-foreground">
          Projects
        </Link>
        <Link href="/settings" className="hover:text-foreground">
          Settings
        </Link>
      </nav>
      <div className="ml-auto">
        <ThemeToggle />
      </div>
    </header>
  );
}
