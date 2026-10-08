"use client";

import { FieldsEditor, type EntityOption } from "@/components/designer/inspector/fields-editor";
import { Field, SelectField, SwitchField } from "@/components/designer/inspector/fields";
import { Button } from "@/components/ui/button";
import type { TypeShape } from "@/lib/design/schema";

type Mode = "none" | "entity" | "inline";

const modeOf = (shape: TypeShape | null): Mode =>
  shape === null ? "none" : shape.entityId ? "entity" : "inline";

/** Edits an API request/response or channel payload: nothing, an entity (or list of it), or inline fields. */
export function ShapeEditor({
  label,
  shape,
  onChange,
  entities,
  allowNone = true,
}: {
  label: string;
  shape: TypeShape | null;
  onChange: (shape: TypeShape | null) => void;
  entities: EntityOption[];
  allowNone?: boolean;
}) {
  const mode = modeOf(shape);
  const base: TypeShape = shape ?? { entityId: null, list: false, fields: [], description: "" };

  function pick(next: Mode) {
    if (next === mode) return;
    if (next === "none") onChange(null);
    else if (next === "entity") onChange({ ...base, entityId: entities[0]?.id ?? null });
    else onChange({ ...base, entityId: null });
  }

  const modes: { mode: Mode; label: string; disabled?: boolean }[] = [
    ...(allowNone ? [{ mode: "none" as const, label: "None" }] : []),
    { mode: "entity", label: "Entity", disabled: entities.length === 0 },
    { mode: "inline", label: "Inline fields" },
  ];

  return (
    <Field label={label}>
      <div role="group" aria-label={`${label} type`} className="flex gap-1">
        {modes.map((m) => (
          <Button
            key={m.mode}
            type="button"
            size="xs"
            variant={mode === m.mode ? "secondary" : "outline"}
            aria-pressed={mode === m.mode}
            disabled={m.disabled}
            onClick={() => pick(m.mode)}
          >
            {m.label}
          </Button>
        ))}
      </div>
      {mode === "entity" && (
        <div className="grid gap-2">
          <SelectField
            compact
            label={`${label} entity`}
            value={base.entityId ?? ""}
            options={entities.map((e) => ({ value: e.id, label: e.name }))}
            onChange={(entityId) => onChange({ ...base, entityId })}
          />
          <SwitchField
            compact
            label="List"
            checked={base.list}
            onChange={(list) => onChange({ ...base, list })}
          />
        </div>
      )}
      {mode === "inline" && (
        <div className="grid gap-2">
          <SwitchField
            compact
            label="List"
            checked={base.list}
            onChange={(list) => onChange({ ...base, list })}
          />
          <FieldsEditor
            label="Fields"
            fields={base.fields}
            entities={entities}
            onChange={(fields) => onChange({ ...base, fields })}
          />
        </div>
      )}
    </Field>
  );
}
