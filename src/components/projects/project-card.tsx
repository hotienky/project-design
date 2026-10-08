"use client";

import { MoreHorizontal } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  deleteProjectAction,
  duplicateProjectAction,
  renameProjectAction,
} from "@/app/actions/projects";
import { RelativeTime } from "@/components/relative-time";
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
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";

export interface ProjectCardData {
  slug: string;
  name: string;
  description: string;
  revision: number;
  latestVersion: number | null;
  nodeCount: number;
  updatedAt: string;
}

export function ProjectCard({ project }: { project: ProjectCardData }) {
  const [dialog, setDialog] = useState<"rename" | "delete" | null>(null);
  const [name, setName] = useState(project.name);
  const [pending, startTransition] = useTransition();

  const run = (
    task: () => Promise<{ ok: boolean; error?: { message: string } }>,
    success?: string,
  ) =>
    startTransition(async () => {
      const result = await task();
      if (!result.ok) toast.error(result.error?.message ?? "Something went wrong");
      else {
        if (success) toast.success(success);
        setDialog(null);
      }
    });

  return (
    <Card className="relative">
      <CardContent className="flex h-full flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <Link
            href={`/projects/${project.slug}`}
            className="font-heading font-medium after:absolute after:inset-0 hover:underline"
          >
            {project.name}
          </Link>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-xs"
                className="relative z-10 -mt-0.5 -mr-1"
                aria-label={`Actions for ${project.name}`}
              >
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href={`/projects/${project.slug}`}>Open</Link>
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => {
                  setName(project.name);
                  setDialog("rename");
                }}
              >
                Rename
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() =>
                  run(
                    () => duplicateProjectAction(project.slug, { name: `${project.name} copy` }),
                    "Project duplicated",
                  )
                }
              >
                Duplicate
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <a href={`/api/projects/${project.slug}/export`} download>
                  Export JSON
                </a>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={() => setDialog("delete")}>
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <p className="line-clamp-2 min-h-10 text-sm text-muted-foreground">
          {project.description || "No description"}
        </p>
        <p className="mt-auto text-xs text-muted-foreground">
          rev {project.revision}
          {project.latestVersion !== null && ` · v${project.latestVersion}`} · {project.nodeCount}{" "}
          {project.nodeCount === 1 ? "component" : "components"} · updated{" "}
          <RelativeTime value={project.updatedAt} />
        </p>
      </CardContent>

      <Dialog open={dialog === "rename"} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              run(() => renameProjectAction(project.slug, { name }));
            }}
            className="grid gap-4"
          >
            <DialogHeader>
              <DialogTitle>Rename project</DialogTitle>
            </DialogHeader>
            <Input
              value={name}
              maxLength={120}
              aria-label="Project name"
              autoFocus
              onChange={(e) => setName(e.target.value)}
            />
            <DialogFooter>
              <Button type="submit" disabled={pending || name.trim() === ""}>
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={dialog === "delete"} onOpenChange={(o) => !o && setDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {project.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Versions, tokens scoped to it and agent statuses are deleted too.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={(e) => {
                e.preventDefault();
                run(() => deleteProjectAction(project.slug), "Project deleted");
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
