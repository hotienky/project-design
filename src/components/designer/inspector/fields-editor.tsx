"use client";

import { ArrowDown, ArrowUp, MoreHorizontal, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import {
  Field as FormField,
  SelectField,
  SwitchField,
  TextField,
} from "@/components/designer/inspector/fields";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FIELD_TYPES, type Field } from "@/lib/design/schema";

const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

export interface EntityOption {
  id: string;
  name: string;
}

/**
 * A compact editor for a list of typed fields (entity columns or inline payload fields).
 * Renames and removals go through `onRename`/`onRemove` when given, so the caller can keep
 * indexes consistent; everything else is a plain `onChange` of the whole list.
 */
export function FieldsEditor({
  label = "Fields",
  fields,
  onChange,
  onRename,
  onRemove,
  entities,
}: {
  label?: string;
  fields: Field[];
  onChange: (fields: Field[]) => void;
  onRename?: (from: string, to: string) => void;
  onRemove?: (name: string) => void;
  entities: EntityOption[];
}) {
  const [describing, setDescribing] = useState<Set<number>>(new Set());
  const update = (index: number, patch: Partial<Field>) =>
    onChange(fields.map((f, i) => (i === index ? { ...f, ...patch } : f)));

  function changeType(index: number, type: Field["type"]) {
    const current = fields[index]!;
    if (type === "enum") {
      update(index, {
        type,
        enumValues: current.enumValues.length > 0 ? current.enumValues : ["value"],
        refEntityId: null,
      });
    } else if (type === "ref") {
      const target = entities[0]?.id;
      if (!target) return toast.error("Create an entity first, then reference it");
      update(index, { type, refEntityId: current.refEntityId ?? target });
    } else update(index, { type, refEntityId: null });
  }

  function add() {
    let n = fields.length + 1;
    while (fields.some((f) => f.name === `field${n}`)) n++;
    onChange([
      ...fields,
      {
        name: `field${n}`,
        type: "string",
        required: true,
        list: false,
        unique: false,
        primary: false,
        default: null,
        enumValues: [],
        refEntityId: null,
        description: "",
      },
    ]);
  }

  function move(index: number, by: -1 | 1) {
    const next = [...fields];
    const [item] = next.splice(index, 1);
    next.splice(index + by, 0, item!);
    onChange(next);
  }

  return (
    <FormField label={label}>
      <ul className="grid gap-2">
        {fields.map((f, index) => (
          <li key={index} className="grid gap-1.5 rounded-md border p-2">
            <div className="flex items-start gap-1">
              <div className="min-w-0 flex-1">
                <TextField
                  compact
                  mono
                  label={`Field name ${index + 1}`}
                  value={f.name}
                  validate={(text) =>
                    !IDENTIFIER.test(text)
                      ? "Use letters, digits and _, not starting with a digit"
                      : text.length > 64
                        ? "At most 64 characters"
                        : fields.some((o, i) => i !== index && o.name === text)
                          ? `"${text}" already exists`
                          : null
                  }
                  onCommit={(name) => (onRename ? onRename(f.name, name) : update(index, { name }))}
                />
              </div>
              <div className="w-28 shrink-0">
                <SelectField
                  compact
                  label={`Type of ${f.name}`}
                  value={f.type}
                  options={FIELD_TYPES.map((t) => ({
                    value: t,
                    label: t,
                    disabled: t === "ref" && entities.length === 0,
                  }))}
                  onChange={(t) => changeType(index, t)}
                />
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon-sm" aria-label={`Actions for field ${f.name}`}>
                    <MoreHorizontal />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem disabled={index === 0} onSelect={() => move(index, -1)}>
                    <ArrowUp /> Move up
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={index === fields.length - 1}
                    onSelect={() => move(index, 1)}
                  >
                    <ArrowDown /> Move down
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() =>
                      setDescribing((s) => {
                        const next = new Set(s);
                        if (next.has(index)) next.delete(index);
                        else next.add(index);
                        return next;
                      })
                    }
                  >
                    Description
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    variant="destructive"
                    onSelect={() =>
                      onRemove ? onRemove(f.name) : onChange(fields.filter((_, i) => i !== index))
                    }
                  >
                    <Trash2 /> Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1">
              <SwitchField
                compact
                label="Req"
                checked={f.required}
                onChange={(required) => update(index, { required })}
              />
              <SwitchField
                compact
                label="List"
                checked={f.list}
                onChange={(list) => update(index, { list })}
              />
              <SwitchField
                compact
                label="Unique"
                checked={f.unique}
                onChange={(unique) => update(index, { unique })}
              />
              <SwitchField
                compact
                label="PK"
                checked={f.primary}
                onChange={(primary) => update(index, { primary })}
              />
            </div>
            {f.type === "enum" && (
              <TextField
                compact
                mono
                label={`Enum values of ${f.name}`}
                placeholder="open, done"
                value={f.enumValues.join(", ")}
                validate={(text) => {
                  const values = text
                    .split(",")
                    .map((v) => v.trim())
                    .filter(Boolean);
                  return values.length === 0
                    ? "An enum needs at least one value"
                    : values.some((v) => v.length > 64)
                      ? "Values are at most 64 characters"
                      : null;
                }}
                onCommit={(text) =>
                  update(index, {
                    enumValues: text
                      .split(",")
                      .map((v) => v.trim())
                      .filter(Boolean),
                  })
                }
              />
            )}
            {f.type === "ref" && (
              <SelectField
                compact
                label={`Entity of ${f.name}`}
                value={f.refEntityId ?? ""}
                options={entities.map((e) => ({ value: e.id, label: e.name }))}
                onChange={(refEntityId) => update(index, { refEntityId })}
              />
            )}
            <TextField
              compact
              mono
              label={`Default of ${f.name}`}
              placeholder="Default value"
              value={f.default ?? ""}
              validate={(text) => (text.length > 200 ? "At most 200 characters" : null)}
              onCommit={(text) => update(index, { default: text === "" ? null : text })}
            />
            {describing.has(index) && (
              <TextField
                compact
                multiline
                label={`Description of ${f.name}`}
                placeholder="Description"
                value={f.description}
                onCommit={(description) => update(index, { description })}
              />
            )}
          </li>
        ))}
      </ul>
      <Button variant="outline" size="sm" className="justify-start" onClick={add}>
        <Plus /> Add field
      </Button>
    </FormField>
  );
}
