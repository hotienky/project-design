"use client";

import { Plus, Trash2 } from "lucide-react";

import { Field, SwitchField, TextField } from "@/components/designer/inspector/fields";
import { Button } from "@/components/ui/button";
import type { EnvVar } from "@/lib/design/schema";

const NAME_PATTERN = /^[A-Z][A-Z0-9_]*$/;

export function EnvEditor({
  label = "Environment variables",
  env,
  onChange,
}: {
  label?: string;
  env: EnvVar[];
  onChange: (env: EnvVar[]) => void;
}) {
  const update = (index: number, patch: Partial<EnvVar>) =>
    onChange(env.map((v, i) => (i === index ? { ...v, ...patch } : v)));

  function add() {
    let name = "NEW_VAR";
    for (let n = 2; env.some((v) => v.name === name); n++) name = `NEW_VAR_${n}`;
    onChange([...env, { name, description: "", required: true, secret: false, example: "" }]);
  }

  return (
    <Field label={label}>
      <ul className="grid gap-2">
        {env.map((v, index) => (
          <li key={index} className="grid gap-1.5 rounded-md border p-2">
            <div className="flex items-start gap-1">
              <div className="min-w-0 flex-1">
                <TextField
                  compact
                  mono
                  label={`Variable name ${index + 1}`}
                  value={v.name}
                  validate={(text) =>
                    !NAME_PATTERN.test(text)
                      ? "Use UPPER_SNAKE_CASE, starting with a letter"
                      : text.length > 100
                        ? "Too long"
                        : null
                  }
                  onCommit={(name) => update(index, { name })}
                />
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Remove ${v.name}`}
                onClick={() => onChange(env.filter((_, i) => i !== index))}
              >
                <Trash2 />
              </Button>
            </div>
            <div className="flex gap-4">
              <SwitchField
                compact
                label="Required"
                checked={v.required}
                onChange={(required) => update(index, { required })}
              />
              <SwitchField
                compact
                label="Secret"
                checked={v.secret}
                onChange={(secret) => update(index, { secret })}
              />
            </div>
            <TextField
              compact
              label={`${v.name} description`}
              placeholder="Description"
              value={v.description}
              onCommit={(description) => update(index, { description })}
            />
            <TextField
              compact
              mono
              label={`${v.name} example`}
              placeholder="Example value"
              value={v.example}
              onCommit={(example) => update(index, { example })}
            />
          </li>
        ))}
      </ul>
      <Button variant="outline" size="sm" className="justify-start" onClick={add}>
        <Plus /> Add variable
      </Button>
    </Field>
  );
}
