"use client";

import { useEffect, useMemo, useRef } from "react";

import { EnvEditor } from "@/components/designer/inspector/env-editor";
import { ChannelsEditor } from "@/components/designer/inspector/channels-editor";
import {
  Field,
  NumberField,
  SelectField,
  Section,
  TextField,
  validateWith,
} from "@/components/designer/inspector/fields";
import { FieldsEditor, type EntityOption } from "@/components/designer/inspector/fields-editor";
import {
  ACTOR_TYPES,
  API_AUTH,
  API_STYLES,
  CONTENT_TYPE_OPTIONS,
  DATASTORE_ENGINES,
  GAME_PRIORITY_OPTIONS,
  GAME_SYSTEM_CATEGORY_OPTIONS,
  INTEGRATION_CATEGORIES,
  NOTE_COLOR_NAMES,
  QUEUE_TECHNOLOGIES,
  RESOURCE_TYPE_OPTIONS,
  SERVICE_TYPES,
  SYSTEM_AUTHORITIES,
} from "@/components/designer/inspector/options";
import { OperationsEditor } from "@/components/designer/inspector/operations-editor";
import { ContentTableEditor } from "@/components/designer/inspector/content-table-editor";
import {
  FormulasEditor,
  ParametersEditor,
} from "@/components/designer/inspector/parameters-editor";
import { PatternsPicker } from "@/components/designer/inspector/patterns-picker";
import { StringList } from "@/components/designer/inspector/string-list";
import { TagsInput } from "@/components/designer/inspector/tags-input";
import { NOTE_COLORS, STATUS_STYLE } from "@/components/designer/nodes/kind-style";
import { useDesigner, useDesignerStore } from "@/components/designer/store-provider";
import { RelativeTime } from "@/components/relative-time";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { canContain, NODE_KIND_META } from "@/lib/design/catalog";
import { SERVICE_TEMPLATES } from "@/lib/design/service-templates";
import { subtreeIds } from "@/lib/design/geometry";
import { indexDesign } from "@/lib/design/graph";
import type { DesignNode, Field as DesignField } from "@/lib/design/schema";
import { cn } from "@/lib/utils";
import { useSelection } from "@/stores/selection-store";
import { useStatusStore } from "@/stores/status-store";
import { toast } from "sonner";
import { z } from "zod";

const TOP_LEVEL = "__top__";
const nameSchema = validateWith(
  z.string().trim().min(1, "Name is required").max(120, "At most 120 characters"),
);
const shortText = (max: number) => validateWith(z.string().max(max, `At most ${max} characters`));

export function NodeForm({ node }: { node: DesignNode }) {
  const store = useDesignerStore();
  const document = useDesigner((s) => s.document);
  const index = useMemo(() => indexDesign(document), [document]);
  const status = useStatusStore((s) => s.statuses[node.id]);
  const nameRef = useRef<HTMLInputElement>(null);
  const focusFor = useSelection((s) => s.focusNameFor);

  useEffect(() => {
    if (focusFor === node.id) {
      nameRef.current?.focus();
      nameRef.current?.select();
      useSelection.getState().consumeNameFocus();
    }
  }, [focusFor, node.id]);

  const update = (fn: (n: DesignNode) => DesignNode) => store.getState().updateNode(node.id, fn);
  const setData = (patch: Record<string, unknown>) =>
    update((n) => ({ ...n, data: { ...n.data, ...patch } }) as DesignNode);
  const entities: EntityOption[] = document.nodes
    .filter((n) => n.kind === "entity")
    .map((n) => ({ id: n.id, name: n.name }));

  const parent = node.parentId ? index.node(node.parentId) : null;
  const excluded = subtreeIds(document, node.id);
  const moveTargets = document.nodes.filter(
    (c) => !excluded.has(c.id) && c.id !== node.parentId && canContain(c.kind, node.kind),
  );
  const canBeTopLevel = canContain(null, node.kind) && node.parentId !== null;

  return (
    <div>
      <Section title={NODE_KIND_META[node.kind].label}>
        <TextField
          label="Name"
          value={node.name}
          inputRef={nameRef}
          validate={nameSchema}
          onCommit={(name) => update((n) => ({ ...n, name }))}
        />
        <TextField
          label={node.kind === "note" ? "Text" : "Description"}
          multiline
          value={node.description}
          hint="Markdown supported"
          validate={shortText(10_000)}
          onCommit={(description) => update((n) => ({ ...n, description }))}
        />
        <TagsInput tags={node.tags} onChange={(tags) => update((n) => ({ ...n, tags }))} />
        <PatternsPicker
          patterns={node.patterns}
          onChange={(patterns) => update((n) => ({ ...n, patterns }))}
        />
        <Field label="Parent">
          <p className="text-sm">{parent ? index.path(parent.id) : "Top level"}</p>
          {(moveTargets.length > 0 || canBeTopLevel) && (
            <Select
              value=""
              onValueChange={(v) => store.getState().setParent(node.id, v === TOP_LEVEL ? null : v)}
            >
              <SelectTrigger className="w-full" size="sm" aria-label="Move to">
                <SelectValue placeholder="Move to…" />
              </SelectTrigger>
              <SelectContent>
                {canBeTopLevel && <SelectItem value={TOP_LEVEL}>Top level</SelectItem>}
                {moveTargets.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {index.path(c.id)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </Field>
        {status && (
          <Field label="Status">
            <div className="flex items-center gap-2 text-sm">
              <Badge className={STATUS_STYLE[status.status].badge}>
                {STATUS_STYLE[status.status].label}
              </Badge>
              <span className="text-xs text-muted-foreground">
                updated <RelativeTime value={status.updatedAt} />
              </span>
            </div>
            {status.note && <p className="text-sm text-muted-foreground">{status.note}</p>}
          </Field>
        )}
      </Section>

      <Section title="Details" className="border-b-0">
        {node.kind === "service" && (
          <>
            <Field
              label="Template"
              hint="Fills language, framework and runtime, and adds scoped tech stack, conventions and layers. Existing content is kept."
            >
              <Select
                value=""
                onValueChange={(templateId) => {
                  const added = store.getState().applyServiceTemplate(node.id, templateId);
                  toast.success(
                    `Template applied: ${added.stack} stack items, ${added.conventions} conventions, ${added.layers} layers`,
                  );
                }}
              >
                <SelectTrigger className="w-full" size="sm" aria-label="Apply template">
                  <SelectValue placeholder="Apply template…" />
                </SelectTrigger>
                <SelectContent>
                  {SERVICE_TEMPLATES.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <SelectField
              label="Type"
              value={node.data.type}
              options={SERVICE_TYPES}
              onChange={(type) => setData({ type })}
            />
            <TextField
              label="Language"
              value={node.data.language}
              validate={shortText(60)}
              onCommit={(language) => setData({ language })}
            />
            <TextField
              label="Framework"
              value={node.data.framework}
              validate={shortText(60)}
              onCommit={(framework) => setData({ framework })}
            />
            <TextField
              label="Runtime"
              value={node.data.runtime}
              validate={shortText(60)}
              onCommit={(runtime) => setData({ runtime })}
            />
            <TextField
              label="Path"
              mono
              value={node.data.path}
              validate={shortText(200)}
              onCommit={(path) => setData({ path })}
            />
            <Field label="Port">
              <NumberField
                compact
                label="Port"
                value={node.data.port}
                min={1}
                max={65535}
                onCommit={(port) => setData({ port })}
              />
            </Field>
            <StringList
              label="Responsibilities"
              items={node.data.responsibilities}
              onChange={(responsibilities) => setData({ responsibilities })}
            />
            <EnvEditor env={node.data.env} onChange={(env) => setData({ env })} />
          </>
        )}
        {node.kind === "layer" && (
          <>
            <TextField
              label="Path"
              mono
              value={node.data.path}
              validate={shortText(200)}
              onCommit={(path) => setData({ path })}
            />
            <StringList
              label="Responsibilities"
              items={node.data.responsibilities}
              onChange={(responsibilities) => setData({ responsibilities })}
            />
            <StringList
              label="Rules"
              items={node.data.rules}
              onChange={(rules) => setData({ rules })}
            />
            <Field
              label="May depend on"
              hint="Draw a “depends on” connection from this layer to allow a dependency."
            >
              <ul className="text-sm">
                {index.outgoing(node.id, "depends_on").map((e) => (
                  <li key={e.id}>{index.node(e.target)?.name}</li>
                ))}
                {index.outgoing(node.id, "depends_on").length === 0 && (
                  <li className="text-muted-foreground">No other layer</li>
                )}
              </ul>
            </Field>
          </>
        )}
        {node.kind === "module" && (
          <>
            <TextField
              label="Path"
              mono
              value={node.data.path}
              validate={shortText(200)}
              onCommit={(path) => setData({ path })}
            />
            <StringList
              label="Responsibilities"
              items={node.data.responsibilities}
              onChange={(responsibilities) => setData({ responsibilities })}
            />
            <StringList
              label="Exports"
              mono
              items={node.data.exports}
              onChange={(exports) => setData({ exports })}
            />
          </>
        )}
        {node.kind === "entity" && (
          <>
            <FieldsEditor
              fields={node.data.fields}
              entities={entities.filter((e) => e.id !== node.id)}
              onChange={(fields) => setData({ fields })}
              onRename={(from, to) => store.getState().renameField(node.id, from, to)}
              onRemove={(name) => store.getState().removeField(node.id, name)}
            />
            <IndexesEditor
              fields={node.data.fields}
              indexes={node.data.indexes}
              onChange={(indexes) => setData({ indexes })}
            />
          </>
        )}
        {node.kind === "datastore" && (
          <>
            <SelectField
              label="Engine"
              value={node.data.engine}
              options={DATASTORE_ENGINES}
              onChange={(engine) => setData({ engine })}
            />
            <TextField
              label="Version"
              value={node.data.version}
              validate={shortText(40)}
              onCommit={(version) => setData({ version })}
            />
            <TextField
              label="Purpose"
              multiline
              value={node.data.purpose}
              validate={shortText(2000)}
              onCommit={(purpose) => setData({ purpose })}
            />
          </>
        )}
        {node.kind === "api" && (
          <>
            <SelectField
              label="Style"
              value={node.data.style}
              options={API_STYLES}
              onChange={(style) => setData({ style })}
            />
            <TextField
              label="Base path"
              mono
              value={node.data.basePath}
              validate={shortText(200)}
              onCommit={(basePath) => setData({ basePath })}
            />
            <TextField
              label="Version"
              value={node.data.version}
              validate={shortText(40)}
              onCommit={(version) => setData({ version })}
            />
            <SelectField
              label="Auth"
              value={node.data.auth}
              options={API_AUTH}
              onChange={(auth) => setData({ auth })}
            />
            <OperationsEditor
              operations={node.data.operations}
              rest={node.data.style === "rest"}
              entities={entities}
              onChange={(operations) => setData({ operations })}
              onRemove={(id) => store.getState().removeOperation(node.id, id)}
            />
          </>
        )}
        {node.kind === "integration" && (
          <>
            <TextField
              label="Provider"
              value={node.data.provider}
              validate={shortText(80)}
              onCommit={(provider) => setData({ provider })}
            />
            <SelectField
              label="Category"
              value={node.data.category}
              options={INTEGRATION_CATEGORIES}
              onChange={(category) => setData({ category })}
            />
            <TextField
              label="Purpose"
              multiline
              value={node.data.purpose}
              validate={shortText(2000)}
              onCommit={(purpose) => setData({ purpose })}
            />
            <TextField
              label="Docs URL"
              value={node.data.docsUrl}
              validate={shortText(500)}
              onCommit={(docsUrl) => setData({ docsUrl })}
            />
            <TextField
              label="SDK"
              mono
              value={node.data.sdk}
              validate={shortText(120)}
              onCommit={(sdk) => setData({ sdk })}
            />
            <EnvEditor env={node.data.env} onChange={(env) => setData({ env })} />
          </>
        )}
        {node.kind === "queue" && (
          <>
            <SelectField
              label="Technology"
              value={node.data.technology}
              options={QUEUE_TECHNOLOGIES}
              onChange={(technology) => setData({ technology })}
            />
            <ChannelsEditor
              channels={node.data.channels}
              entities={entities}
              onChange={(channels) => setData({ channels })}
              onRemove={(id) => store.getState().removeChannel(node.id, id)}
            />
          </>
        )}
        {node.kind === "actor" && (
          <>
            <SelectField
              label="Type"
              value={node.data.type}
              options={ACTOR_TYPES}
              onChange={(type) => setData({ type })}
            />
            <StringList
              label="Goals"
              items={node.data.goals}
              onChange={(goals) => setData({ goals })}
            />
          </>
        )}
        {node.kind === "loop" && (
          <>
            <TextField
              label="Duration"
              value={node.data.duration}
              placeholder="5–30 seconds"
              validate={shortText(80)}
              onCommit={(duration) => setData({ duration })}
            />
            <TextField
              label="Motivation"
              multiline
              value={node.data.motivation}
              validate={shortText(2000)}
              onCommit={(motivation) => setData({ motivation })}
            />
            <StringList
              label="Steps"
              items={node.data.steps}
              onChange={(steps) => setData({ steps })}
            />
          </>
        )}
        {node.kind === "system" && (
          <>
            <SelectField
              label="Category"
              value={node.data.category}
              options={GAME_SYSTEM_CATEGORY_OPTIONS}
              onChange={(category) => setData({ category })}
            />
            <TextField
              label="Purpose"
              multiline
              value={node.data.purpose}
              validate={shortText(2000)}
              onCommit={(purpose) => setData({ purpose })}
            />
            <SelectField
              label="Authority"
              value={node.data.authority}
              options={SYSTEM_AUTHORITIES}
              hint="Who owns this system's state in multiplayer."
              onChange={(authority) => setData({ authority })}
            />
            <SelectField
              label="Priority"
              value={node.data.priority}
              options={GAME_PRIORITY_OPTIONS}
              onChange={(priority) => setData({ priority })}
            />
            <StringList
              label="Rules"
              items={node.data.rules}
              onChange={(rules) => setData({ rules })}
            />
            <ParametersEditor
              label="Tuning parameters"
              parameters={node.data.parameters}
              onChange={(parameters) => setData({ parameters })}
            />
            <FormulasEditor
              formulas={node.data.formulas}
              onChange={(formulas) => setData({ formulas })}
            />
          </>
        )}
        {node.kind === "mechanic" && (
          <>
            <TextField
              label="Trigger"
              value={node.data.trigger}
              placeholder="Space / B button, enemy killed…"
              validate={shortText(200)}
              onCommit={(trigger) => setData({ trigger })}
            />
            <StringList
              label="States"
              items={node.data.states}
              onChange={(states) => setData({ states })}
            />
            <StringList
              label="Rules"
              items={node.data.rules}
              onChange={(rules) => setData({ rules })}
            />
            <ParametersEditor
              label="Tuning parameters"
              parameters={node.data.parameters}
              onChange={(parameters) => setData({ parameters })}
            />
            <FormulasEditor
              formulas={node.data.formulas}
              onChange={(formulas) => setData({ formulas })}
            />
            <SelectField
              label="Priority"
              value={node.data.priority}
              options={GAME_PRIORITY_OPTIONS}
              onChange={(priority) => setData({ priority })}
            />
          </>
        )}
        {node.kind === "resource" && (
          <>
            <SelectField
              label="Type"
              value={node.data.type}
              options={RESOURCE_TYPE_OPTIONS}
              onChange={(type) => setData({ type })}
            />
            <TextField
              label="Initial"
              value={node.data.initial}
              validate={shortText(60)}
              onCommit={(initial) => setData({ initial })}
            />
            <TextField
              label="Min"
              value={node.data.min}
              validate={shortText(60)}
              onCommit={(min) => setData({ min })}
            />
            <TextField
              label="Max"
              value={node.data.max}
              validate={shortText(60)}
              onCommit={(max) => setData({ max })}
            />
            <TextField
              label="Regen"
              value={node.data.regen}
              placeholder="20/s after 1 s delay"
              validate={shortText(200)}
              onCommit={(regen) => setData({ regen })}
            />
            <Field
              label="Sources"
              hint="Draw a “produces” connection from a system or mechanic to this resource."
            >
              <ul className="text-sm">
                {index.incoming(node.id, "produces").map((e) => (
                  <li key={e.id}>{index.node(e.source)?.name}</li>
                ))}
                {index.incoming(node.id, "produces").length === 0 && (
                  <li className="text-muted-foreground">None</li>
                )}
              </ul>
            </Field>
            <Field
              label="Sinks"
              hint="Draw a “consumes” connection from a system or mechanic to this resource."
            >
              <ul className="text-sm">
                {index.incoming(node.id, "consumes").map((e) => (
                  <li key={e.id}>{index.node(e.source)?.name}</li>
                ))}
                {index.incoming(node.id, "consumes").length === 0 && (
                  <li className="text-muted-foreground">None</li>
                )}
              </ul>
            </Field>
          </>
        )}
        {node.kind === "content" && (
          <>
            <SelectField
              label="Type"
              value={node.data.type}
              options={CONTENT_TYPE_OPTIONS}
              onChange={(type) => setData({ type })}
            />
            <SelectField
              label="Priority"
              value={node.data.priority}
              options={GAME_PRIORITY_OPTIONS}
              onChange={(priority) => setData({ priority })}
            />
            <ContentTableEditor
              columns={node.data.columns}
              rows={node.data.rows}
              onChange={(table) => setData(table)}
            />
          </>
        )}
        {node.kind === "note" && (
          <Field label="Colour">
            <div role="radiogroup" aria-label="Note colour" className="flex gap-2">
              {NOTE_COLOR_NAMES.map((color) => (
                <button
                  key={color}
                  type="button"
                  role="radio"
                  aria-checked={node.data.color === color}
                  aria-label={color}
                  onClick={() => setData({ color })}
                  className={cn(
                    "size-6 rounded-full border",
                    NOTE_COLORS[color],
                    node.data.color === color &&
                      "ring-2 ring-primary ring-offset-2 ring-offset-background",
                  )}
                />
              ))}
            </div>
          </Field>
        )}
      </Section>
    </div>
  );
}

function IndexesEditor({
  fields,
  indexes,
  onChange,
}: {
  fields: DesignField[];
  indexes: { fields: string[]; unique: boolean }[];
  onChange: (indexes: { fields: string[]; unique: boolean }[]) => void;
}) {
  const update = (i: number, patch: Partial<{ fields: string[]; unique: boolean }>) =>
    onChange(indexes.map((x, n) => (n === i ? { ...x, ...patch } : x)));
  return (
    <Field label="Indexes">
      <ul className="grid gap-2">
        {indexes.map((idx, i) => (
          <li key={i} className="grid gap-1.5 rounded-md border p-2">
            <div className="flex flex-wrap gap-1" role="group" aria-label={`Index ${i + 1} fields`}>
              {fields.map((f) => {
                const on = idx.fields.includes(f.name);
                return (
                  <button
                    key={f.name}
                    type="button"
                    aria-pressed={on}
                    className={cn(
                      "rounded border px-1.5 py-0.5 font-mono text-xs",
                      on ? "bg-primary text-primary-foreground" : "text-muted-foreground",
                    )}
                    onClick={() => {
                      const next = on
                        ? idx.fields.filter((x) => x !== f.name)
                        : [...idx.fields, f.name];
                      if (next.length > 0) update(i, { fields: next });
                    }}
                  >
                    {f.name}
                  </button>
                );
              })}
            </div>
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={idx.unique}
                  onChange={(e) => update(i, { unique: e.target.checked })}
                />{" "}
                Unique
              </label>
              <button
                type="button"
                className="text-xs text-destructive hover:underline"
                onClick={() => onChange(indexes.filter((_, n) => n !== i))}
              >
                Remove index
              </button>
            </div>
          </li>
        ))}
      </ul>
      <button
        type="button"
        disabled={fields.length === 0}
        className="self-start text-xs underline disabled:opacity-50"
        onClick={() => onChange([...indexes, { fields: [fields[0]!.name], unique: false }])}
      >
        Add index
      </button>
    </Field>
  );
}
