"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import { Field, SelectField, TextField } from "@/components/designer/inspector/fields";
import { useDesigner, useDesignerStore } from "@/components/designer/store-provider";
import { ScopeBadges, ScopePicker } from "@/components/sections/scope-picker";
import { SectionPage } from "@/components/sections/section-page";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { newItemId } from "@/lib/design/ids";
import { STACK_CATEGORIES, StackItemSchema, type StackItem } from "@/lib/design/schema";

function StackDialog({
  item,
  onClose,
  onSave,
}: {
  item: StackItem | null;
  onClose: () => void;
  onSave: (item: StackItem) => void;
}) {
  const [draft, setDraft] = useState<StackItem | null>(item);
  const parsed = draft ? StackItemSchema.safeParse(draft) : null;
  return (
    <Dialog open={item !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        {draft && (
          <form
            className="grid gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (parsed?.success) onSave(parsed.data);
            }}
          >
            <DialogHeader>
              <DialogTitle>{item?.name ? "Edit stack item" : "Add stack item"}</DialogTitle>
            </DialogHeader>
            <SelectField
              label="Category"
              value={draft.category}
              options={STACK_CATEGORIES}
              onChange={(category) => setDraft({ ...draft, category })}
            />
            <TextField
              label="Name"
              value={draft.name}
              onCommit={(name) => setDraft({ ...draft, name })}
            />
            <TextField
              label="Version"
              value={draft.version}
              onCommit={(version) => setDraft({ ...draft, version })}
            />
            <TextField
              label="Notes"
              multiline
              value={draft.notes}
              onCommit={(notes) => setDraft({ ...draft, notes })}
            />
            <Field label="Applies to">
              <ScopePicker
                value={draft.scope}
                onChange={(scope) => setDraft({ ...draft, scope })}
              />
            </Field>
            <DialogFooter>
              <Button type="submit" disabled={!parsed?.success}>
                Save
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function StackTable() {
  const store = useDesignerStore();
  const stack = useDesigner((s) => s.document.stack);
  const [editing, setEditing] = useState<{ item: StackItem; isNew: boolean } | null>(null);

  const save = (item: StackItem, isNew: boolean) => {
    store.getState().updateSections({
      stack: isNew ? [...stack, item] : stack.map((s) => (s.id === item.id ? item : s)),
    });
    setEditing(null);
  };

  return (
    <SectionPage
      editable
      wide
      title="Tech stack"
      description="The languages, frameworks and tools the design commits to. A scoped choice replaces the project-wide one for those components."
      actions={
        <Button
          size="sm"
          onClick={() =>
            setEditing({
              isNew: true,
              item: {
                id: newItemId("stk"),
                category: "framework",
                name: "",
                version: "",
                notes: "",
                scope: [],
              },
            })
          }
        >
          <Plus /> Add
        </Button>
      }
    >
      {stack.length === 0 ? (
        <p className="text-sm text-muted-foreground">No stack choices yet.</p>
      ) : (
        STACK_CATEGORIES.filter((c) => stack.some((s) => s.category === c)).map((category) => (
          <section key={category} className="grid gap-1">
            <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {category}
            </h2>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-48">Name</TableHead>
                  <TableHead className="w-24">Version</TableHead>
                  <TableHead>Applies to</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead className="w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {stack
                  .filter((s) => s.category === category)
                  .map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell>{s.version}</TableCell>
                      <TableCell>
                        <ScopeBadges ids={s.scope} />
                      </TableCell>
                      <TableCell className="whitespace-normal text-muted-foreground">
                        {s.notes}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          aria-label={`Edit ${s.name}`}
                          onClick={() => setEditing({ item: s, isNew: false })}
                        >
                          <Pencil />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          aria-label={`Delete ${s.name}`}
                          onClick={() =>
                            store
                              .getState()
                              .updateSections({ stack: stack.filter((x) => x.id !== s.id) })
                          }
                        >
                          <Trash2 />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </section>
        ))
      )}
      {editing && (
        <StackDialog
          key={editing.item.id}
          item={editing.item}
          onClose={() => setEditing(null)}
          onSave={(item) => save(item, editing.isNew)}
        />
      )}
    </SectionPage>
  );
}
