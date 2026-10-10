"use client";

import { Download, PlugZap } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { useAppUrl } from "@/components/designer/store-provider";
import { ConnectSnippets } from "@/components/settings/connect-snippets";
import { ExportDiagramDialog } from "@/components/designer/export-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function ExportMenu() {
  const [diagramOpen, setDiagramOpen] = useState(false);
  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setDiagramOpen(true)}>
        <Download /> Export
      </Button>
      <ExportDiagramDialog open={diagramOpen} onOpenChange={setDiagramOpen} />
    </>
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
