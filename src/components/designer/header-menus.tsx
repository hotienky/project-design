"use client";

import { ChevronDown, Download, PlugZap } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { useAppUrl, useProjectMeta, useSaveNow } from "@/components/designer/store-provider";
import { ConnectSnippets } from "@/components/settings/connect-snippets";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function download(url: string) {
  const link = document.createElement("a");
  link.href = url;
  link.download = "";
  document.body.append(link);
  link.click();
  link.remove();
}

export function ExportMenu() {
  const { slug } = useProjectMeta();
  const saveNow = useSaveNow();
  // The server exports what it has saved, so flush pending edits first.
  const run = (path: string) => async () => {
    await saveNow();
    download(`/api/projects/${slug}/${path}`);
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm">
          <Download /> Export <ChevronDown />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={run("export?version=draft")}>Design JSON</DropdownMenuItem>
        <DropdownMenuItem onSelect={run("brief?version=draft")}>Markdown brief</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function ConnectDialog() {
  const appUrl = useAppUrl();
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <PlugZap /> Connect agent
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Connect a coding agent</DialogTitle>
          <DialogDescription>
            Create a token under{" "}
            <Link href="/settings" className="underline" onClick={() => setOpen(false)}>
              Settings
            </Link>{" "}
            (a project-scoped one is best), then add this server to your agent.
          </DialogDescription>
        </DialogHeader>
        <ConnectSnippets appUrl={appUrl} />
      </DialogContent>
    </Dialog>
  );
}
