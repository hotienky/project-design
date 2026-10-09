"use client";

import { FolderOpen, LogOut, Settings } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface MenuUser {
  login: string;
  name: string;
  avatarUrl: string;
}

export function UserMenu({ user }: { user: MenuUser }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={`Account (${user.login})`}>
          <Avatar user={user} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex items-center gap-2">
          <Avatar user={user} />
          <span className="min-w-0 leading-tight">
            <span className="block truncate text-sm font-medium text-foreground">
              {user.name || user.login}
            </span>
            <span className="block truncate text-xs text-muted-foreground">@{user.login}</span>
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/projects">
            <FolderOpen /> Projects
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/settings">
            <Settings /> Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <form action="/api/auth/logout" method="post">
          <DropdownMenuItem asChild>
            <button type="submit" className="w-full">
              <LogOut /> Sign out
            </button>
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Avatar({ user }: { user: MenuUser }) {
  if (!user.avatarUrl) {
    return (
      <span className="grid size-6 place-items-center rounded-full bg-muted text-[10px] font-semibold uppercase">
        {user.login.slice(0, 2)}
      </span>
    );
  }
  // A tiny remote avatar; next/image would need remotePatterns for one 24px picture.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={user.avatarUrl} alt="" className="size-6 rounded-full" />;
}
