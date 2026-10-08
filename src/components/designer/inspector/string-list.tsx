"use client";

import { Plus, X } from "lucide-react";
import { useState } from "react";

import { Field, TextField } from "@/components/designer/inspector/fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const MAX_LENGTH = 500;
const validate = (text: string) =>
  text.length > MAX_LENGTH ? `At most ${MAX_LENGTH} characters` : null;

/** An editable list of short text lines. Emptying a row removes it. */
export function StringList({
  label,
  items,
  onChange,
  mono,
  placeholder,
}: {
  label: string;
  items: string[];
  onChange: (items: string[]) => void;
  mono?: boolean;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const text = draft.trim();
    if (text === "" || validate(text)) return;
    onChange([...items, text]);
    setDraft("");
  };
  return (
    <Field label={label}>
      <ul className="grid gap-1.5">
        {items.map((item, index) => (
          <li key={index} className="flex items-start gap-1">
            <div className="min-w-0 flex-1">
              <TextField
                compact
                label={`${label} ${index + 1}`}
                value={item}
                mono={mono}
                validate={validate}
                onCommit={(text) => {
                  const trimmed = text.trim();
                  onChange(
                    trimmed === ""
                      ? items.filter((_, i) => i !== index)
                      : items.map((x, i) => (i === index ? trimmed : x)),
                  );
                }}
              />
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Remove ${label} ${index + 1}`}
              onClick={() => onChange(items.filter((_, i) => i !== index))}
            >
              <X />
            </Button>
          </li>
        ))}
      </ul>
      <div className="flex gap-1">
        <Input
          value={draft}
          placeholder={placeholder ?? `Add ${label.toLowerCase()}…`}
          aria-label={`New ${label}`}
          className={mono ? "font-mono text-xs" : undefined}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          onBlur={add}
        />
        <Button
          variant="outline"
          size="icon-sm"
          aria-label={`Add ${label}`}
          onClick={add}
          disabled={draft.trim() === ""}
        >
          <Plus />
        </Button>
      </div>
    </Field>
  );
}
