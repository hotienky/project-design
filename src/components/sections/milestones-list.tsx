"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import { Field, TextField } from "@/components/designer/inspector/fields";
import { StringList } from "@/components/designer/inspector/string-list";
import { useDesigner, useDesignerStore } from "@/components/designer/store-provider";
import { ScopeBadges, ScopePicker } from "@/components/sections/scope-picker";
import { SectionPage } from "@/components/sections/section-page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { NODE_KINDS, MilestoneSchema, type Milestone } from "@/lib/design/schema";
import { newItemId } from "@/lib/design/ids";

function MilestoneDialog({
  milestone,
  isNew,
  onClose,
  onSave,
  onDelete,
}: {
  milestone: Milestone;
  isNew: boolean;
  onClose: () => void;
  onSave: (m: Milestone) => void;
  onDelete: () => void;
}) {
  const [draft, setDraft] = useState(milestone);
  const parsed = MilestoneSchema.safeParse(draft);
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <form
          className="grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (parsed.success) onSave(parsed.data);
          }}
        >
          <DialogHeader>
            <DialogTitle>{isNew ? "New milestone" : "Edit milestone"}</DialogTitle>
          </DialogHeader>
          <TextField
            label="Title"
            value={draft.title}
            validate={(t) => (t.trim() === "" ? "Title is required" : null)}
            onCommit={(title) => setDraft({ ...draft, title })}
          />
          <TextField
            label="Timeframe"
            placeholder="Weeks 1–3, Q1 2027…"
            value={draft.timeframe}
            validate={(t) => (t.length > 80 ? "At most 80 characters" : null)}
            onCommit={(timeframe) => setDraft({ ...draft, timeframe })}
          />
          <StringList
            label="Deliverables"
            items={draft.deliverables}
            onChange={(deliverables) => setDraft({ ...draft, deliverables })}
          />
          <TextField
            label="Exit criteria"
            multiline
            hint="How you know this milestone is done."
            value={draft.exitCriteria}
            validate={(t) => (t.length > 2000 ? "At most 2000 characters" : null)}
            onCommit={(exitCriteria) => setDraft({ ...draft, exitCriteria })}
          />
          <Field label="Scope">
            <ScopePicker
              label="Scope"
              kinds={NODE_KINDS}
              value={draft.scope}
              onChange={(scope) => setDraft({ ...draft, scope })}
            />
          </Field>
          <DialogFooter className="sm:justify-between">
            {!isNew ? (
              <Button type="button" variant="destructive" onClick={onDelete}>
                <Trash2 /> Delete
              </Button>
            ) : (
              <span />
            )}
            <Button type="submit" disabled={!parsed.success}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function MilestonesList() {
  const store = useDesignerStore();
  const milestones = useDesigner((s) => s.document.milestones);
  const [editing, setEditing] = useState<{ milestone: Milestone; isNew: boolean } | null>(null);

  const commit = (next: Milestone[]) => store.getState().updateSections({ milestones: next });

  return (
    <SectionPage
      editable
      title="Roadmap"
      description="Milestones in build order, each with what it delivers and when it is done."
      actions={
        <Button
          size="sm"
          onClick={() =>
            setEditing({
              isNew: true,
              milestone: {
                id: newItemId("ms"),
                title: "",
                timeframe: "",
                deliverables: [],
                exitCriteria: "",
                scope: [],
              },
            })
          }
        >
          <Plus /> Add
        </Button>
      }
    >
      {milestones.length === 0 && (
        <p className="text-sm text-muted-foreground">No milestones planned yet.</p>
      )}
      <ol className="grid gap-2">
        {milestones.map((m) => (
          <li key={m.id}>
            <button
              type="button"
              className="flex w-full flex-col gap-1.5 rounded-lg border p-3 text-left hover:bg-muted/50"
              onClick={() => setEditing({ milestone: m, isNew: false })}
            >
              <span className="flex items-center gap-2">
                <span className="font-medium">{m.title}</span>
                {m.timeframe && <Badge variant="secondary">{m.timeframe}</Badge>}
              </span>
              {m.deliverables.length > 0 && (
                <ul className="list-disc pl-4 text-sm text-muted-foreground">
                  {m.deliverables.map((d, i) => (
                    <li key={i}>{d}</li>
                  ))}
                </ul>
              )}
              {m.exitCriteria && (
                <span className="text-sm">
                  <span className="text-xs font-medium text-muted-foreground">Done when: </span>
                  {m.exitCriteria}
                </span>
              )}
              {m.scope.length > 0 && <ScopeBadges ids={m.scope} />}
            </button>
          </li>
        ))}
      </ol>
      {editing && (
        <MilestoneDialog
          key={editing.milestone.id}
          milestone={editing.milestone}
          isNew={editing.isNew}
          onClose={() => setEditing(null)}
          onSave={(m) => {
            commit(
              editing.isNew ? [...milestones, m] : milestones.map((x) => (x.id === m.id ? m : x)),
            );
            setEditing(null);
          }}
          onDelete={() => {
            commit(milestones.filter((x) => x.id !== editing.milestone.id));
            setEditing(null);
          }}
        />
      )}
    </SectionPage>
  );
}
