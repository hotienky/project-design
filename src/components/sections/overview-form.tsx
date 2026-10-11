"use client";

import { Plus, Trash2 } from "lucide-react";

import { Field, SelectField, TextField } from "@/components/designer/inspector/fields";
import { ParametersEditor } from "@/components/designer/inspector/parameters-editor";
import { StringList } from "@/components/designer/inspector/string-list";
import { useDesigner, useDesignerStore } from "@/components/designer/store-provider";
import { SectionPage } from "@/components/sections/section-page";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ARCHITECTURE_STYLE_DESCRIPTIONS } from "@/lib/design/catalog";
import { ARCHITECTURE_STYLES, DESIGN_MODES, type DesignDocument } from "@/lib/design/schema";

type Overview = DesignDocument["overview"];
type Reference = Overview["game"]["references"][number];

const MODE_LABEL = { software: "Software", game: "Game" } as const;

/** Reference games: name + what to take from each. Emptying a name removes the row. */
function ReferencesEditor({
  references,
  onChange,
}: {
  references: Reference[];
  onChange: (references: Reference[]) => void;
}) {
  const update = (index: number, patch: Partial<Reference>) =>
    onChange(references.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  return (
    <Field label="References" hint="Games to learn from, and what to take from each.">
      <ul className="grid gap-2">
        {references.map((r, index) => (
          <li key={index} className="grid gap-1.5 rounded-md border p-2">
            <div className="flex items-start gap-1">
              <div className="min-w-0 flex-1">
                <TextField
                  compact
                  label={`Reference name ${index + 1}`}
                  placeholder="Game"
                  value={r.name}
                  validate={(t) => (t.length > 80 ? "At most 80 characters" : null)}
                  onCommit={(text) => {
                    const name = text.trim();
                    if (name === "") onChange(references.filter((_, i) => i !== index));
                    else update(index, { name });
                  }}
                />
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Remove ${r.name}`}
                onClick={() => onChange(references.filter((_, i) => i !== index))}
              >
                <Trash2 />
              </Button>
            </div>
            <TextField
              compact
              label={`${r.name} takeaway`}
              placeholder="What to take from it"
              value={r.takeaway}
              validate={(t) => (t.length > 500 ? "At most 500 characters" : null)}
              onCommit={(takeaway) => update(index, { takeaway })}
            />
          </li>
        ))}
      </ul>
      <Button
        variant="outline"
        size="sm"
        className="justify-start"
        onClick={() => {
          let n = references.length + 1;
          while (references.some((r) => r.name === `Game ${n}`)) n++;
          onChange([...references, { name: `Game ${n}`, takeaway: "" }]);
        }}
      >
        <Plus /> Add reference
      </Button>
    </Field>
  );
}

export function OverviewForm() {
  const store = useDesignerStore();
  const overview = useDesigner((s) => s.document.overview);
  const update = (patch: Partial<Overview>) =>
    store
      .getState()
      .updateSections({ overview: { ...store.getState().document.overview, ...patch } });
  const updateRepo = (patch: Partial<Overview["repository"]>) =>
    update({ repository: { ...overview.repository, ...patch } });
  const updateGame = (patch: Partial<Overview["game"]>) =>
    update({ game: { ...overview.game, ...patch } });
  const tooLong = (max: number) => (text: string) =>
    text.length > max ? `At most ${max} characters` : null;

  return (
    <SectionPage
      editable
      title="Overview"
      description="What you are building and how it is organised. Agents read this first."
    >
      <Field label="Design mode">
        <div role="radiogroup" aria-label="Design mode" className="flex gap-4">
          {DESIGN_MODES.map((mode) => (
            <Label key={mode} className="flex items-center gap-2 text-sm font-normal">
              <input
                type="radio"
                name="design-mode"
                checked={overview.mode === mode}
                onChange={() => update({ mode })}
                className="accent-primary"
              />
              {MODE_LABEL[mode]}
            </Label>
          ))}
        </div>
      </Field>
      <TextField
        label="Summary"
        multiline
        value={overview.summary}
        validate={tooLong(10_000)}
        onCommit={(summary) => update({ summary })}
      />
      {overview.mode === "game" && (
        <>
          <h3 className="text-sm font-semibold">Game vision</h3>
          <TextField
            label="Genre"
            value={overview.game.genre}
            validate={tooLong(120)}
            onCommit={(genre) => updateGame({ genre })}
          />
          <TextField
            label="Engine"
            value={overview.game.engine}
            validate={tooLong(80)}
            onCommit={(engine) => updateGame({ engine })}
          />
          <StringList
            label="Platforms"
            items={overview.game.platforms}
            onChange={(platforms) => updateGame({ platforms })}
          />
          <StringList
            label="Design pillars"
            items={overview.game.pillars}
            onChange={(pillars) => updateGame({ pillars })}
          />
          <ParametersEditor
            label="Design parameters"
            hint="Players, camera, session length, monetization…"
            parameters={overview.game.parameters}
            onChange={(parameters) => updateGame({ parameters })}
          />
          <ReferencesEditor
            references={overview.game.references}
            onChange={(references) => updateGame({ references })}
          />
          <ParametersEditor
            label="Performance & quality targets"
            parameters={overview.game.targets}
            onChange={(targets) => updateGame({ targets })}
          />
        </>
      )}
      <StringList label="Goals" items={overview.goals} onChange={(goals) => update({ goals })} />
      <StringList
        label="Non-goals"
        items={overview.nonGoals}
        onChange={(nonGoals) => update({ nonGoals })}
      />
      <SelectField
        label="Architecture style"
        value={overview.architectureStyle}
        options={ARCHITECTURE_STYLES}
        hint={ARCHITECTURE_STYLE_DESCRIPTIONS[overview.architectureStyle]}
        onChange={(architectureStyle) => update({ architectureStyle })}
      />
      <TextField
        label="Architecture notes"
        multiline
        value={overview.architectureNotes}
        validate={tooLong(10_000)}
        onCommit={(architectureNotes) => update({ architectureNotes })}
      />
      <Field label="Repository layout">
        <div role="radiogroup" aria-label="Repository layout" className="flex gap-4">
          {(["single-package", "monorepo"] as const).map((layout) => (
            <Label key={layout} className="flex items-center gap-2 text-sm font-normal">
              <input
                type="radio"
                name="repository-layout"
                checked={overview.repository.layout === layout}
                onChange={() => updateRepo({ layout })}
                className="accent-primary"
              />
              {layout}
            </Label>
          ))}
        </div>
      </Field>
      <TextField
        label="Package manager"
        value={overview.repository.packageManager}
        validate={tooLong(40)}
        onCommit={(packageManager) => updateRepo({ packageManager })}
      />
      <TextField
        label="Repository notes"
        multiline
        value={overview.repository.notes}
        validate={tooLong(4000)}
        onCommit={(notes) => updateRepo({ notes })}
      />
    </SectionPage>
  );
}
