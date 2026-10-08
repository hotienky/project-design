"use client";

import { X } from "lucide-react";
import { useState } from "react";

import { Field } from "@/components/designer/inspector/fields";
import { Input } from "@/components/ui/input";

const MAX_TAGS = 30;

/** Enter or comma adds a tag; Backspace in the empty input removes the last one. */
export function TagsInput({
  tags,
  onChange,
}: {
  tags: string[];
  onChange: (tags: string[]) => void;
}) {
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  function add(raw: string) {
    const tag = raw.trim();
    if (tag === "") return;
    if (tag.length > 40) return setError("Tags are at most 40 characters");
    if (tags.includes(tag)) return setError(`"${tag}" is already added`);
    if (tags.length >= MAX_TAGS) return setError(`At most ${MAX_TAGS} tags`);
    setError(null);
    onChange([...tags, tag]);
    setDraft("");
  }

  return (
    <Field label="Tags" error={error}>
      <div className="flex flex-wrap items-center gap-1 rounded-lg border bg-transparent p-1.5 focus-within:ring-3 focus-within:ring-ring/50">
        {tags.map((tag) => (
          <span
            key={tag}
            className="flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-xs"
          >
            {tag}
            <button
              type="button"
              aria-label={`Remove tag ${tag}`}
              className="text-muted-foreground hover:text-foreground"
              onClick={() => onChange(tags.filter((t) => t !== tag))}
            >
              <X className="size-3" />
            </button>
          </span>
        ))}
        <Input
          value={draft}
          aria-label="Add tag"
          placeholder={tags.length === 0 ? "Add a tag…" : ""}
          className="h-6 min-w-20 flex-1 border-0 bg-transparent px-1 shadow-none focus-visible:ring-0 dark:bg-transparent"
          onChange={(e) => {
            const text = e.target.value;
            if (text.includes(",")) {
              const [first, ...rest] = text.split(",");
              add(first ?? "");
              setDraft(rest.join(","));
            } else setDraft(text);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add(draft);
            } else if (e.key === "Backspace" && draft === "" && tags.length > 0) {
              onChange(tags.slice(0, -1));
            }
          }}
          onBlur={() => add(draft)}
        />
      </div>
    </Field>
  );
}
