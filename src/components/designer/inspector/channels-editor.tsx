"use client";

import { Plus, Trash2 } from "lucide-react";

import { Field, TextField } from "@/components/designer/inspector/fields";
import type { EntityOption } from "@/components/designer/inspector/fields-editor";
import { ShapeEditor } from "@/components/designer/inspector/shape-editor";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { newItemId } from "@/lib/design/ids";
import type { NodeOfKind } from "@/lib/design/schema";

type Channel = NodeOfKind<"queue">["data"]["channels"][number];

export function ChannelsEditor({
  channels,
  entities,
  onChange,
  onRemove,
}: {
  channels: Channel[];
  entities: EntityOption[];
  onChange: (channels: Channel[]) => void;
  onRemove: (channelId: string) => void;
}) {
  const update = (index: number, patch: Partial<Channel>) =>
    onChange(channels.map((c, i) => (i === index ? { ...c, ...patch } : c)));

  function add() {
    let n = channels.length + 1;
    while (channels.some((c) => c.name === `channel${n}`)) n++;
    onChange([
      ...channels,
      {
        id: newItemId("ch"),
        name: `channel${n}`,
        description: "",
        payload: { entityId: null, list: false, fields: [], description: "" },
      },
    ]);
  }

  return (
    <Field label="Channels">
      <Accordion type="multiple" className="rounded-md border">
        {channels.map((channel, index) => (
          <AccordionItem key={channel.id} value={channel.id}>
            <AccordionTrigger className="px-2 py-1.5 text-left font-mono text-xs">
              {channel.name}
            </AccordionTrigger>
            <AccordionContent className="grid gap-3 px-2">
              <TextField
                label="Name"
                value={channel.name}
                validate={(text) =>
                  text.trim() === ""
                    ? "Name is required"
                    : text.length > 200
                      ? "At most 200 characters"
                      : null
                }
                onCommit={(name) => update(index, { name })}
              />
              <TextField
                label="Description"
                value={channel.description}
                onCommit={(description) => update(index, { description })}
              />
              <ShapeEditor
                label="Payload"
                shape={channel.payload}
                entities={entities}
                allowNone={false}
                onChange={(payload) => payload && update(index, { payload })}
              />
              <Button variant="destructive" size="sm" onClick={() => onRemove(channel.id)}>
                <Trash2 /> Delete channel
              </Button>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
      <Button variant="outline" size="sm" className="justify-start" onClick={add}>
        <Plus /> Add channel
      </Button>
    </Field>
  );
}
