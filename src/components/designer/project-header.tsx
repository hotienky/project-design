"use client";

import { AlertTriangle, CircleAlert, Network, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { renameProjectAction } from "@/app/actions/projects";
import { ConnectDialog, ExportMenu } from "@/components/designer/header-menus";
import { PublishDialog } from "@/components/designer/publish-dialog";
import { SaveIndicator } from "@/components/designer/save-indicator";
import { useDesigner, useProjectMeta } from "@/components/designer/store-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { validateDesign } from "@/lib/design/validate";
import { useCanvasUi } from "@/stores/canvas-ui-store";

const TABS = [
  { segment: "", label: "Canvas" },
  { segment: "overview", label: "Overview" },
  { segment: "stack", label: "Stack" },
  { segment: "conventions", label: "Conventions" },
  { segment: "decisions", label: "Decisions" },
  { segment: "brief", label: "Brief" },
  { segment: "versions", label: "Versions" },
] as const;

function ProjectName() {
  const { name, slug } = useProjectMeta();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const [, startTransition] = useTransition();

  function commit() {
    setEditing(false);
    const next = draft.trim();
    if (next === "" || next === name) return;
    startTransition(async () => {
      const result = await renameProjectAction(slug, { name: next });
      if (!result.ok) toast.error(result.error.message);
    });
  }

  if (editing) {
    return (
      <Input
        value={draft}
        maxLength={120}
        aria-label="Project name"
        autoFocus
        className="h-6 w-64"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") setEditing(false);
        }}
      />
    );
  }
  return (
    <button
      type="button"
      className="-mx-1 truncate rounded px-1 text-left font-heading text-sm font-semibold hover:bg-muted"
      title="Click to rename"
      onClick={() => {
        setDraft(name);
        setEditing(true);
      }}
    >
      {name}
    </button>
  );
}

function ValidateButton() {
  const document = useDesigner((s) => s.document);
  const open = useCanvasUi((s) => s.validationOpen);
  const pathname = usePathname();
  const router = useRouter();
  const { slug } = useProjectMeta();
  const layout = useCanvasUi((s) => s.viewMode);
  const issues = useMemo(() => validateDesign(document, { layout }), [document, layout]);
  const errors = issues.filter((i) => i.severity === "error").length;
  const warnings = issues.filter((i) => i.severity === "warning").length;
  const count = errors || warnings;
  return (
    <Button
      variant={open ? "secondary" : "ghost"}
      size="sm"
      aria-pressed={open}
      onClick={() => {
        if (pathname !== `/projects/${slug}`) {
          useCanvasUi.getState().toggleValidation(true);
          router.push(`/projects/${slug}`);
        } else useCanvasUi.getState().toggleValidation();
      }}
    >
      {errors ? (
        <CircleAlert className="text-red-500" />
      ) : warnings ? (
        <AlertTriangle className="text-amber-500" />
      ) : (
        <ShieldCheck />
      )}
      Validate
      {count > 0 && (
        <span
          className={`rounded-full px-1.5 text-xs ${errors ? "bg-red-500/15 text-red-600" : "bg-amber-500/15 text-amber-600"}`}
          aria-label={`${count} ${errors ? "errors" : "warnings"}`}
        >
          {count}
        </span>
      )}
    </Button>
  );
}

export function ProjectHeader() {
  const { slug, description } = useProjectMeta();
  const pathname = usePathname();
  return (
    <div className="shrink-0 border-b bg-background">
      <div className="flex h-14 items-center gap-3 px-4">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg border bg-background shadow-xs">
          <Network className="size-4 text-muted-foreground" aria-hidden />
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <ProjectName />
            <SaveIndicator />
          </div>
          <p className="max-w-xl truncate text-xs text-muted-foreground">
            {description || "Architecture design for coding agents"}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className="flex items-center divide-x overflow-hidden rounded-lg border bg-background shadow-xs [&>button]:rounded-none [&>button]:border-0 [&>button]:shadow-none">
            <ValidateButton />
            <ExportMenu />
            <ConnectDialog />
          </div>
          <PublishDialog />
        </div>
      </div>
      <nav aria-label="Project sections" className="flex h-11 items-center px-4">
        <div className="inline-flex items-center gap-0.5 rounded-lg bg-muted p-0.5">
          {TABS.map((tab) => {
            const href = tab.segment ? `/projects/${slug}/${tab.segment}` : `/projects/${slug}`;
            const active = pathname === href;
            return (
              <Link
                key={tab.label}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`rounded-md px-3 py-1 text-sm transition-colors ${active ? "bg-background font-medium text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"}`}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
