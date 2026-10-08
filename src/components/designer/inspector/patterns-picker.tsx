"use client";

import { Plus, X } from "lucide-react";
import { useState } from "react";

import { Field, TextField } from "@/components/designer/inspector/fields";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { PATTERNS } from "@/lib/design/catalog";

type PatternUse = { name: string; notes: string };

const CATEGORIES = [...new Set(PATTERNS.map((p) => p.category))];

export function PatternsPicker({
  patterns,
  onChange,
}: {
  patterns: PatternUse[];
  onChange: (patterns: PatternUse[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const chosen = new Set(patterns.map((p) => p.name.toLowerCase()));
  const typed = query.trim();
  const canUseTyped =
    typed !== "" &&
    typed.length <= 80 &&
    !chosen.has(typed.toLowerCase()) &&
    !PATTERNS.some((p) => p.name.toLowerCase() === typed.toLowerCase());

  function add(name: string) {
    if (!chosen.has(name.toLowerCase())) onChange([...patterns, { name, notes: "" }]);
    setOpen(false);
    setQuery("");
  }

  return (
    <Field label="Patterns">
      {patterns.length > 0 && (
        <ul className="grid gap-2">
          {patterns.map((p, index) => (
            <li key={p.name} className="grid gap-1 rounded-md border p-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{p.name}</span>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label={`Remove pattern ${p.name}`}
                  onClick={() => onChange(patterns.filter((_, i) => i !== index))}
                >
                  <X />
                </Button>
              </div>
              <TextField
                compact
                label={`Notes for ${p.name}`}
                placeholder="How it is applied here"
                value={p.notes}
                onCommit={(notes) =>
                  onChange(patterns.map((x, i) => (i === index ? { ...x, notes } : x)))
                }
              />
            </li>
          ))}
        </ul>
      )}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="justify-start">
            <Plus /> Add pattern
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-0" align="start">
          <Command>
            <CommandInput
              placeholder="Search or type a pattern…"
              value={query}
              onValueChange={setQuery}
            />
            <CommandList>
              <CommandEmpty>No pattern found.</CommandEmpty>
              {canUseTyped && (
                <CommandGroup heading="Custom">
                  <CommandItem value={`custom-${typed}`} onSelect={() => add(typed)}>
                    Use &lsquo;{typed}&rsquo;
                  </CommandItem>
                </CommandGroup>
              )}
              {CATEGORIES.map((category) => (
                <CommandGroup key={category} heading={category}>
                  {PATTERNS.filter(
                    (p) => p.category === category && !chosen.has(p.name.toLowerCase()),
                  ).map((p) => (
                    <CommandItem key={p.name} value={p.name} onSelect={() => add(p.name)}>
                      <span className="flex flex-col">
                        <span>{p.name}</span>
                        <span className="text-xs text-muted-foreground">{p.summary}</span>
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              ))}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </Field>
  );
}
