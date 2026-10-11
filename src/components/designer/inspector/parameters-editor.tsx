"use client";

import { Plus, Trash2 } from "lucide-react";

import { Field, TextField } from "@/components/designer/inspector/fields";
import { Button } from "@/components/ui/button";
import type { Formula, Parameter } from "@/lib/design/schema";

const tooLong = (max: number) => (text: string) =>
  text.length > max ? `At most ${max} characters` : null;

/** Name / value / unit rows with optional notes. Emptying a name removes the row. */
export function ParametersEditor({
  label,
  parameters,
  onChange,
  hint,
}: {
  label: string;
  parameters: Parameter[];
  onChange: (parameters: Parameter[]) => void;
  hint?: string;
}) {
  const update = (index: number, patch: Partial<Parameter>) =>
    onChange(parameters.map((p, i) => (i === index ? { ...p, ...patch } : p)));

  function add() {
    let n = parameters.length + 1;
    while (parameters.some((p) => p.name === `parameter ${n}`)) n++;
    onChange([...parameters, { name: `parameter ${n}`, value: "", unit: "", notes: "" }]);
  }

  return (
    <Field label={label} hint={hint}>
      <ul className="grid gap-2">
        {parameters.map((p, index) => (
          <li key={index} className="grid gap-1.5 rounded-md border p-2">
            <div className="flex items-start gap-1">
              <div className="min-w-0 flex-1">
                <TextField
                  compact
                  label={`${label} name ${index + 1}`}
                  placeholder="Name"
                  value={p.name}
                  validate={tooLong(80)}
                  onCommit={(text) => {
                    const name = text.trim();
                    if (name === "") onChange(parameters.filter((_, i) => i !== index));
                    else update(index, { name });
                  }}
                />
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Remove ${p.name}`}
                onClick={() => onChange(parameters.filter((_, i) => i !== index))}
              >
                <Trash2 />
              </Button>
            </div>
            <div className="grid grid-cols-[1fr_5.5rem] gap-1.5">
              <TextField
                compact
                label={`${p.name} value`}
                placeholder="Value"
                value={p.value}
                validate={tooLong(200)}
                onCommit={(value) => update(index, { value })}
              />
              <TextField
                compact
                label={`${p.name} unit`}
                placeholder="Unit"
                value={p.unit}
                validate={tooLong(40)}
                onCommit={(unit) => update(index, { unit })}
              />
            </div>
            <TextField
              compact
              label={`${p.name} notes`}
              placeholder="Notes"
              value={p.notes}
              validate={tooLong(1000)}
              onCommit={(notes) => update(index, { notes })}
            />
          </li>
        ))}
      </ul>
      <Button variant="outline" size="sm" className="justify-start" onClick={add}>
        <Plus /> Add parameter
      </Button>
    </Field>
  );
}

/** Named formulas: a monospace expression plus notes. Emptying a name or expression removes the row. */
export function FormulasEditor({
  formulas,
  onChange,
}: {
  formulas: Formula[];
  onChange: (formulas: Formula[]) => void;
}) {
  const update = (index: number, patch: Partial<Formula>) =>
    onChange(formulas.map((f, i) => (i === index ? { ...f, ...patch } : f)));
  const remove = (index: number) => onChange(formulas.filter((_, i) => i !== index));

  function add() {
    let n = formulas.length + 1;
    while (formulas.some((f) => f.name === `formula ${n}`)) n++;
    onChange([...formulas, { name: `formula ${n}`, expression: "x = y", notes: "" }]);
  }

  return (
    <Field label="Formulas">
      <ul className="grid gap-2">
        {formulas.map((f, index) => (
          <li key={index} className="grid gap-1.5 rounded-md border p-2">
            <div className="flex items-start gap-1">
              <div className="min-w-0 flex-1">
                <TextField
                  compact
                  label={`Formula name ${index + 1}`}
                  placeholder="Name"
                  value={f.name}
                  validate={tooLong(80)}
                  onCommit={(text) => {
                    const name = text.trim();
                    if (name === "") remove(index);
                    else update(index, { name });
                  }}
                />
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Remove ${f.name}`}
                onClick={() => remove(index)}
              >
                <Trash2 />
              </Button>
            </div>
            <TextField
              compact
              mono
              label={`${f.name} expression`}
              placeholder="D_final = D_raw × 100 / (100 + A)"
              value={f.expression}
              validate={tooLong(500)}
              onCommit={(text) => {
                const expression = text.trim();
                if (expression === "") remove(index);
                else update(index, { expression });
              }}
            />
            <TextField
              compact
              label={`${f.name} notes`}
              placeholder="Notes"
              value={f.notes}
              validate={tooLong(1000)}
              onCommit={(notes) => update(index, { notes })}
            />
          </li>
        ))}
      </ul>
      <Button variant="outline" size="sm" className="justify-start" onClick={add}>
        <Plus /> Add formula
      </Button>
    </Field>
  );
}
