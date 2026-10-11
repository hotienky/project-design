"use client";

import { Check, ChevronsUpDown } from "lucide-react";
import { useState } from "react";

import { useDesigner } from "@/components/designer/store-provider";
import { Badge } from "@/components/ui/badge";
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
import { indexDesign } from "@/lib/design/graph";
import { cn } from "@/lib/utils";

const SCOPE_KINDS = ["service", "layer", "module"];

/** Multi-select of the services, layers and modules a stack item or convention applies to. Empty = whole project. */
export function ScopePicker({
  value,
  onChange,
  label = "Applies to",
  kinds = SCOPE_KINDS,
}: {
  value: string[];
  onChange: (ids: string[]) => void;
  label?: string;
  kinds?: readonly string[];
}) {
  const document = useDesigner((s) => s.document);
  const [open, setOpen] = useState(false);
  const nodes = document.nodes.filter((n) => kinds.includes(n.kind));
  const index = indexDesign(document);
  const toggle = (id: string) =>
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-auto min-h-8 w-full justify-between py-1 font-normal"
          aria-label={label}
        >
          <span className="flex flex-wrap gap-1">
            {value.length === 0 ? (
              <span className="text-muted-foreground">Everything</span>
            ) : (
              value.map((id) => (
                <Badge key={id} variant="secondary">
                  {index.node(id)?.name ?? id}
                </Badge>
              ))
            )}
          </span>
          <ChevronsUpDown className="size-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <Command>
          <CommandInput placeholder="Search components…" />
          <CommandList>
            <CommandEmpty>No services, layers or modules yet.</CommandEmpty>
            <CommandGroup>
              {nodes.map((n) => (
                <CommandItem
                  key={n.id}
                  value={`${index.path(n.id)} ${n.id}`}
                  onSelect={() => toggle(n.id)}
                >
                  <Check
                    className={cn("size-4", value.includes(n.id) ? "opacity-100" : "opacity-0")}
                  />
                  <span className="truncate">{index.path(n.id)}</span>
                  <span className="ml-auto text-xs text-muted-foreground">{n.kind}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/** Read-only scope: names as badges, or "Everything". */
export function ScopeBadges({ ids }: { ids: string[] }) {
  const document = useDesigner((s) => s.document);
  if (ids.length === 0) return <span className="text-muted-foreground">Everything</span>;
  const index = indexDesign(document);
  return (
    <span className="flex flex-wrap gap-1">
      {ids.map((id) => (
        <Badge key={id} variant="secondary">
          {index.node(id)?.name ?? id}
        </Badge>
      ))}
    </span>
  );
}
