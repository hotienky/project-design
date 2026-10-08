"use client";

import { Plus, Trash2 } from "lucide-react";

import { Field, NumberField, SelectField, TextField } from "@/components/designer/inspector/fields";
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
import { HTTP_METHODS, type Operation } from "@/lib/design/schema";

const NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_.]*$/;
const AUTH = ["inherit", "none", "required"] as const;

export function OperationsEditor({
  operations,
  rest,
  entities,
  onChange,
  onRemove,
}: {
  operations: Operation[];
  /** REST APIs show method and path. */
  rest: boolean;
  entities: EntityOption[];
  onChange: (operations: Operation[]) => void;
  onRemove: (operationId: string) => void;
}) {
  const update = (index: number, patch: Partial<Operation>) =>
    onChange(operations.map((o, i) => (i === index ? { ...o, ...patch } : o)));

  function add() {
    let n = operations.length + 1;
    while (operations.some((o) => o.name === `operation${n}`)) n++;
    onChange([
      ...operations,
      {
        id: newItemId("op"),
        name: `operation${n}`,
        summary: "",
        method: rest ? "GET" : null,
        path: rest ? "/" : null,
        auth: "inherit",
        request: null,
        response: null,
        errors: [],
      },
    ]);
  }

  return (
    <Field label="Operations">
      <Accordion type="multiple" className="rounded-md border">
        {operations.map((op, index) => (
          <AccordionItem key={op.id} value={op.id}>
            <AccordionTrigger className="px-2 py-1.5 text-left text-xs">
              <span className="truncate">
                {rest && op.method ? (
                  <span className="font-mono font-semibold">{op.method} </span>
                ) : null}
                {rest && op.path ? <span className="font-mono">{op.path} · </span> : null}
                {op.name}
              </span>
            </AccordionTrigger>
            <AccordionContent className="grid gap-3 px-2">
              <TextField
                label="Name"
                mono
                value={op.name}
                validate={(text) =>
                  !NAME_PATTERN.test(text) || text.length > 80
                    ? "Use an identifier like listTasks"
                    : null
                }
                onCommit={(name) => update(index, { name })}
              />
              <TextField
                label="Summary"
                value={op.summary}
                onCommit={(summary) => update(index, { summary })}
              />
              {rest && (
                <div className="grid grid-cols-[6rem_1fr] gap-2">
                  <SelectField
                    label="Method"
                    value={op.method ?? "GET"}
                    options={HTTP_METHODS}
                    onChange={(method) => update(index, { method })}
                  />
                  <TextField
                    label="Path"
                    mono
                    placeholder="/projects/{projectId}/tasks"
                    value={op.path ?? ""}
                    validate={(text) => (text.length > 300 ? "At most 300 characters" : null)}
                    onCommit={(path) =>
                      update(index, { path: path.trim() === "" ? null : path.trim() })
                    }
                  />
                </div>
              )}
              <SelectField
                label="Auth"
                value={op.auth}
                options={AUTH}
                onChange={(auth) => update(index, { auth })}
              />
              <ShapeEditor
                label="Request"
                shape={op.request}
                entities={entities}
                onChange={(request) => update(index, { request })}
              />
              <ShapeEditor
                label="Response"
                shape={op.response}
                entities={entities}
                onChange={(response) => update(index, { response })}
              />
              <Field label="Errors">
                <ul className="grid gap-1.5">
                  {op.errors.map((error, e) => (
                    <li key={e} className="flex items-start gap-1">
                      <div className="w-16 shrink-0">
                        <NumberField
                          compact
                          label={`Error status ${e + 1}`}
                          value={error.status}
                          min={100}
                          max={599}
                          onCommit={(status) =>
                            update(index, {
                              errors: op.errors.map((x, i) =>
                                i === e ? { ...x, status: status ?? 400 } : x,
                              ),
                            })
                          }
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <TextField
                          compact
                          label={`Error description ${e + 1}`}
                          placeholder="Description"
                          value={error.description}
                          onCommit={(description) =>
                            update(index, {
                              errors: op.errors.map((x, i) =>
                                i === e ? { ...x, description } : x,
                              ),
                            })
                          }
                        />
                      </div>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Remove error ${e + 1}`}
                        onClick={() =>
                          update(index, { errors: op.errors.filter((_, i) => i !== e) })
                        }
                      >
                        <Trash2 />
                      </Button>
                    </li>
                  ))}
                </ul>
                <Button
                  variant="outline"
                  size="xs"
                  className="justify-start"
                  onClick={() =>
                    update(index, { errors: [...op.errors, { status: 400, description: "" }] })
                  }
                >
                  <Plus /> Add error
                </Button>
              </Field>
              <Button variant="destructive" size="sm" onClick={() => onRemove(op.id)}>
                <Trash2 /> Delete operation
              </Button>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
      <Button variant="outline" size="sm" className="justify-start" onClick={add}>
        <Plus /> Add operation
      </Button>
    </Field>
  );
}
