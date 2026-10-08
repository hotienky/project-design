"use client";

import { AlertTriangle, CircleAlert, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { renameProjectAction } from "@/app/actions/projects";
import { SaveIndicator } from "@/components/designer/save-indicator";
import { useDesigner, useProjectMeta } from "@/components/designer/store-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { validateDesign } from "@/lib/design/validate";
import { useCanvasUi } from "@/stores/canvas-ui-store";

const TABS = [{ segment: "", label: "Canvas" }] as const;

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
        className="h-7 w-64"
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
      className="rounded px-1 font-heading text-sm font-semibold hover:bg-muted"
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
  const issues = useMemo(() => validateDesign(document), [document]);
  const errors = issues.filter((i) => i.severity === "error").length;
  const warnings = issues.filter((i) => i.severity === "warning").length;
  const count = errors || warnings;
  return (
    <Button
      variant={open ? "secondary" : "outline"}
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
  const { slug } = useProjectMeta();
  const pathname = usePathname();
  return (
    <div className="shrink-0 border-b bg-background">
      <div className="flex h-12 items-center gap-3 px-4">
        <ProjectName />
        <SaveIndicator />
        <div className="ml-auto flex items-center gap-2">
          <ValidateButton />
        </div>
      </div>
      <nav aria-label="Project sections" className="flex h-10 items-end gap-1 px-4">
        {TABS.map((tab) => {
          const href = tab.segment ? `/projects/${slug}/${tab.segment}` : `/projects/${slug}`;
          const active = pathname === href;
          return (
            <Link
              key={tab.label}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`border-b-2 px-3 pb-2 text-sm ${active ? "border-primary font-medium text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
