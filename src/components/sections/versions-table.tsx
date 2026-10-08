"use client";

import { Download, GitCompare, RotateCcw } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { restoreVersionAction } from "@/app/actions/versions";
import { PublishDialog } from "@/components/designer/publish-dialog";
import {
  useDesigner,
  useDesignerStore,
  useProjectMeta,
  useSaveNow,
} from "@/components/designer/store-provider";
import { RelativeTime } from "@/components/relative-time";
import { DiffView } from "@/components/sections/diff-view";
import { SectionPage } from "@/components/sections/section-page";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export interface VersionRow {
  version: number;
  label: string;
  notes: string;
  createdAt: string;
  nodeCount: number;
}

export function VersionsTable({ versions }: { versions: VersionRow[] }) {
  const { slug } = useProjectMeta();
  const store = useDesignerStore();
  const draft = useDesigner((s) => s.document);
  const saveNow = useSaveNow();
  const [diffing, setDiffing] = useState<number | null>(null);
  const [restoring, setRestoring] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();

  function restore(version: number) {
    startTransition(async () => {
      await saveNow(); // restore replaces the saved draft; make sure ours is what the server has
      const result = await restoreVersionAction(slug, version, store.getState().revision);
      if (result.ok) {
        store.getState().replaceDocument(result.document, result.revision);
        toast.success(`Restored v${version} into the draft`);
        setRestoring(null);
      } else toast.error(result.error.message);
    });
  }

  return (
    <SectionPage
      wide
      title="Versions"
      description="Immutable snapshots of the design. Agents can pin to one while you keep editing."
      actions={<PublishDialog />}
    >
      {versions.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Publish a version to give agents a stable design to build against.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-20">Version</TableHead>
              <TableHead>Label</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="w-28">Components</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {versions.map((v) => (
              <TableRow key={v.version}>
                <TableCell className="font-medium">v{v.version}</TableCell>
                <TableCell>
                  {v.notes ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="underline decoration-dotted">{v.label || "—"}</span>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-80 whitespace-pre-wrap">
                        {v.notes}
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    v.label || "—"
                  )}
                </TableCell>
                <TableCell>
                  <RelativeTime value={v.createdAt} />
                </TableCell>
                <TableCell>{v.nodeCount}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="xs" onClick={() => setDiffing(v.version)}>
                    <GitCompare /> View changes vs draft
                  </Button>
                  <Button variant="ghost" size="xs" asChild>
                    <a href={`/api/projects/${slug}/export?version=${v.version}`} download>
                      <Download /> Export JSON
                    </a>
                  </Button>
                  <Button
                    variant="ghost"
                    size="xs"
                    aria-label={`Restore v${v.version}`}
                    onClick={() => setRestoring(v.version)}
                  >
                    <RotateCcw /> Restore
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={diffing !== null} onOpenChange={(open) => !open && setDiffing(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Changes since v{diffing}</DialogTitle>
          </DialogHeader>
          {diffing !== null && <DiffView slug={slug} version={diffing} draft={draft} />}
        </DialogContent>
      </Dialog>

      <AlertDialog open={restoring !== null} onOpenChange={(open) => !open && setRestoring(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore v{restoring}?</AlertDialogTitle>
            <AlertDialogDescription>
              Replaces the draft. Your current draft can be recovered with undo until you leave the
              page.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending}
              onClick={(e) => {
                e.preventDefault();
                if (restoring !== null) restore(restoring);
              }}
            >
              Restore
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SectionPage>
  );
}
