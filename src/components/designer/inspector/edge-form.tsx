"use client";

import { toast } from "sonner";

import {
  Field,
  Section,
  SelectField,
  SwitchField,
  TextField,
} from "@/components/designer/inspector/fields";
import { useDesigner, useDesignerStore } from "@/components/designer/store-provider";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { allowedEdgeKinds, EDGE_KIND_META } from "@/lib/design/catalog";
import { EdgeSchema, type DesignEdge, type EdgeKind, type NodeOfKind } from "@/lib/design/schema";
import { useSelection } from "@/stores/selection-store";

const PROTOCOLS = ["http", "grpc", "graphql", "websocket", "in-process", "other"] as const;
const MODES = ["read", "write", "read-write"] as const;
const CARDINALITIES = ["one-to-one", "one-to-many", "many-to-many"] as const;
const ON_DELETE = ["no-action", "cascade", "restrict", "set-null"] as const;

/** Checklist of an API's operations, for `calls` and `exposes` edges. */
function OperationsField({
  api,
  value,
  hint,
  onChange,
}: {
  api: NodeOfKind<"api">;
  value: string[];
  hint: string;
  onChange: (operations: string[]) => void;
}) {
  return (
    <Field label="Operations" hint={hint}>
      <ul className="grid gap-1.5">
        {api.data.operations.map((op) => (
          <li key={op.id} className="flex items-center gap-2">
            <Checkbox
              id={`op-${op.id}`}
              checked={value.includes(op.id)}
              onCheckedChange={(on) =>
                onChange(on ? [...value, op.id] : value.filter((x) => x !== op.id))
              }
            />
            <Label htmlFor={`op-${op.id}`} className="font-mono text-xs">
              {op.name}
            </Label>
          </li>
        ))}
        {api.data.operations.length === 0 && (
          <li className="text-sm text-muted-foreground">The API has no operations yet.</li>
        )}
      </ul>
    </Field>
  );
}

export function EdgeForm({ edge }: { edge: DesignEdge }) {
  const store = useDesignerStore();
  const document = useDesigner((s) => s.document);
  const source = document.nodes.find((n) => n.id === edge.source);
  const target = document.nodes.find((n) => n.id === edge.target);
  const kinds = source && target ? allowedEdgeKinds(source.kind, target.kind) : [edge.kind];

  const update = (fn: (e: DesignEdge) => DesignEdge) => store.getState().updateEdge(edge.id, fn);
  const setData = (patch: Record<string, unknown>) =>
    update((e) => ({ ...e, data: { ...e.data, ...patch } }) as DesignEdge);

  function changeKind(kind: EdgeKind) {
    if (kind === edge.kind) return;
    if (
      document.edges.some(
        (e) => e.kind === kind && e.source === edge.source && e.target === edge.target,
      )
    ) {
      toast.info("Already connected that way");
      return;
    }
    // A new kind has different data, so start from its defaults.
    update((e) =>
      EdgeSchema.parse({
        id: e.id,
        kind,
        source: e.source,
        target: e.target,
        label: e.label,
        description: e.description,
      }),
    );
  }

  const select = (id: string) => useSelection.getState().set([id], []);
  const targetEntityFields = target?.kind === "entity" ? target.data.fields.map((f) => f.name) : [];

  return (
    <div>
      <Section title="Connection">
        <SelectField
          label="Kind"
          value={edge.kind}
          options={kinds.map((k) => ({ value: k, label: EDGE_KIND_META[k].label }))}
          hint={EDGE_KIND_META[edge.kind].description}
          onChange={changeKind}
        />
        <Field label="From → To">
          <div className="flex flex-wrap items-center gap-1 text-sm">
            <Button variant="link" size="sm" className="px-0" onClick={() => select(edge.source)}>
              {source?.name ?? edge.source}
            </Button>
            →
            <Button variant="link" size="sm" className="px-0" onClick={() => select(edge.target)}>
              {target?.name ?? edge.target}
            </Button>
          </div>
        </Field>
        <TextField
          label="Label"
          value={edge.label}
          onCommit={(label) => update((e) => ({ ...e, label }))}
        />
        <TextField
          label="Description"
          multiline
          value={edge.description}
          onCommit={(description) => update((e) => ({ ...e, description }))}
        />
      </Section>
      <Section title="Details" className="border-b-0">
        {edge.kind === "depends_on" && (
          <p className="text-sm text-muted-foreground">No extra settings.</p>
        )}
        {edge.kind === "drives" && (
          <p className="text-sm text-muted-foreground">No extra settings.</p>
        )}
        {edge.kind === "produces" && (
          <TextField
            label="Rate"
            placeholder="on kill, 20/s…"
            value={edge.data.rate}
            onCommit={(rate) => setData({ rate })}
          />
        )}
        {edge.kind === "consumes" && (
          <TextField
            label="Amount"
            placeholder="25 per dodge…"
            value={edge.data.amount}
            onCommit={(amount) => setData({ amount })}
          />
        )}
        {edge.kind === "triggers" && (
          <TextField
            label="Event"
            placeholder="enemy defeated…"
            value={edge.data.event}
            onCommit={(event) => setData({ event })}
          />
        )}
        {edge.kind === "modifies" && (
          <TextField
            label="Effect"
            placeholder="+armor, ×1.2 damage…"
            value={edge.data.effect}
            onCommit={(effect) => setData({ effect })}
          />
        )}
        {edge.kind === "exposes" && target?.kind === "api" && (
          <OperationsField
            api={target}
            value={edge.data.operations}
            hint="The endpoints this component implements, e.g. one controller's actions. Leave all unchecked if it implements the whole API."
            onChange={(operations) => setData({ operations })}
          />
        )}
        {edge.kind === "calls" && (
          <>
            <SelectField
              label="Protocol"
              value={edge.data.protocol}
              options={PROTOCOLS}
              onChange={(protocol) => setData({ protocol })}
            />
            {target?.kind === "api" && (
              <OperationsField
                api={target}
                value={edge.data.operations}
                hint="Leave all unchecked if the caller uses the whole API."
                onChange={(operations) => setData({ operations })}
              />
            )}
          </>
        )}
        {edge.kind === "accesses" && (
          <SelectField
            label="Mode"
            value={edge.data.mode}
            options={MODES}
            onChange={(mode) => setData({ mode })}
          />
        )}
        {(edge.kind === "publishes" || edge.kind === "subscribes") && target?.kind === "queue" && (
          <SelectField
            label="Channel"
            value={edge.data.channelId ?? "__any__"}
            options={[
              { value: "__any__", label: "Any channel" },
              ...target.data.channels.map((c) => ({ value: c.id, label: c.name })),
            ]}
            onChange={(v) => setData({ channelId: v === "__any__" ? null : v })}
          />
        )}
        {edge.kind === "uses" && (
          <TextField
            label="Purpose"
            multiline
            value={edge.data.purpose}
            onCommit={(purpose) => setData({ purpose })}
          />
        )}
        {edge.kind === "interacts" && (
          <TextField
            label="Via"
            placeholder="browser, mobile app…"
            value={edge.data.via}
            onCommit={(via) => setData({ via })}
          />
        )}
        {edge.kind === "relation" && (
          <>
            <SelectField
              label="Cardinality"
              value={edge.data.cardinality}
              options={CARDINALITIES}
              onChange={(cardinality) => setData({ cardinality })}
            />
            <TextField
              label="Foreign key"
              mono
              value={edge.data.foreignKey}
              hint={
                targetEntityFields.length > 0
                  ? `Fields on ${target?.name}: ${targetEntityFields.join(", ")}`
                  : "On the target (“many”) entity"
              }
              onCommit={(foreignKey) => setData({ foreignKey })}
            />
            <SwitchField
              label="Required"
              checked={edge.data.required}
              onChange={(required) => setData({ required })}
            />
            <SelectField
              label="On delete"
              value={edge.data.onDelete}
              options={ON_DELETE}
              onChange={(onDelete) => setData({ onDelete })}
            />
          </>
        )}
      </Section>
    </div>
  );
}
