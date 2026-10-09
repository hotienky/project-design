"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import { SelectField, TextField } from "@/components/designer/inspector/fields";
import { useDesigner, useDesignerStore } from "@/components/designer/store-provider";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { newItemId } from "@/lib/design/ids";
import { DecisionSchema, type Decision } from "@/lib/design/schema";

const STATUSES = ["proposed", "accepted", "deprecated", "superseded"] as const;

function DecisionDialog({
  decision,
  isNew,
  onClose,
  onSave,
  onDelete,
}: {
  decision: Decision;
  isNew: boolean;
  onClose: () => void;
  onSave: (d: Decision) => void;
  onDelete: () => void;
}) {
  const [draft, setDraft] = useState(decision);
  const parsed = DecisionSchema.safeParse(draft);
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
            <DialogTitle>{isNew ? "New decision" : "Edit decision"}</DialogTitle>
          </DialogHeader>
          <TextField
            label="Title"
            value={draft.title}
            validate={(t) => (t.trim() === "" ? "Title is required" : null)}
            onCommit={(title) => setDraft({ ...draft, title })}
          />
          <div className="grid grid-cols-2 gap-3">
            <SelectField
              label="Status"
              value={draft.status}
              options={STATUSES}
              onChange={(status) => setDraft({ ...draft, status })}
            />
            <div className="grid gap-1">
              <Label htmlFor="decision-date" className="text-xs">
                Date
              </Label>
              <Input
                id="decision-date"
                type="date"
                value={draft.date}
                onChange={(e) => setDraft({ ...draft, date: e.target.value })}
              />
            </div>
          </div>
          <TextField
            label="Context"
            multiline
            value={draft.context}
            onCommit={(context) => setDraft({ ...draft, context })}
          />
          <TextField
            label="Decision"
            multiline
            value={draft.decision}
            onCommit={(d) => setDraft({ ...draft, decision: d })}
          />
          <TextField
            label="Consequences"
            multiline
            value={draft.consequences}
            onCommit={(consequences) => setDraft({ ...draft, consequences })}
          />
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

const STATUS_COLOR: Record<Decision["status"], string> = {
  proposed: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  accepted: "bg-green-500/15 text-green-700 dark:text-green-300",
  deprecated: "bg-gray-500/15 text-gray-600 dark:text-gray-300",
  superseded: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
};

export function DecisionsList() {
  const store = useDesignerStore();
  const decisions = useDesigner((s) => s.document.decisions);
  const [editing, setEditing] = useState<{ decision: Decision; isNew: boolean } | null>(null);

  const commit = (next: Decision[]) => store.getState().updateSections({ decisions: next });

  return (
    <SectionPage
      editable
      title="Decisions"
      description="Architecture decisions and why they were made, so agents don't undo them."
      actions={
        <Button
          size="sm"
          onClick={() =>
            setEditing({
              isNew: true,
              decision: {
                id: newItemId("adr"),
                title: "",
                status: "proposed",
                context: "",
                decision: "",
                consequences: "",
                date: new Date().toISOString().slice(0, 10),
              },
            })
          }
        >
          <Plus /> Add
        </Button>
      }
    >
      {decisions.length === 0 && (
        <p className="text-sm text-muted-foreground">No decisions recorded yet.</p>
      )}
      <ul className="grid gap-2">
        {decisions.map((d) => (
          <li key={d.id}>
            <button
              type="button"
              className="flex w-full flex-col gap-1 rounded-lg border p-3 text-left hover:bg-muted/50"
              onClick={() => setEditing({ decision: d, isNew: false })}
            >
              <span className="flex items-center gap-2">
                <span className="font-medium">{d.title}</span>
                <Badge className={STATUS_COLOR[d.status]}>{d.status}</Badge>
                {d.date && <span className="ml-auto text-xs text-muted-foreground">{d.date}</span>}
              </span>
              {d.decision && (
                <span className="line-clamp-2 text-sm text-muted-foreground">{d.decision}</span>
              )}
            </button>
          </li>
        ))}
      </ul>
      {editing && (
        <DecisionDialog
          key={editing.decision.id}
          decision={editing.decision}
          isNew={editing.isNew}
          onClose={() => setEditing(null)}
          onSave={(d) => {
            commit(
              editing.isNew ? [...decisions, d] : decisions.map((x) => (x.id === d.id ? d : x)),
            );
            setEditing(null);
          }}
          onDelete={() => {
            commit(decisions.filter((x) => x.id !== editing.decision.id));
            setEditing(null);
          }}
        />
      )}
    </SectionPage>
  );
}
