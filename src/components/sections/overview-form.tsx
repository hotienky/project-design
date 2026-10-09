"use client";

import { Field, SelectField, TextField } from "@/components/designer/inspector/fields";
import { StringList } from "@/components/designer/inspector/string-list";
import { useDesigner, useDesignerStore } from "@/components/designer/store-provider";
import { SectionPage } from "@/components/sections/section-page";
import { Label } from "@/components/ui/label";
import { ARCHITECTURE_STYLE_DESCRIPTIONS } from "@/lib/design/catalog";
import { ARCHITECTURE_STYLES, type DesignDocument } from "@/lib/design/schema";

type Overview = DesignDocument["overview"];

export function OverviewForm() {
  const store = useDesignerStore();
  const overview = useDesigner((s) => s.document.overview);
  const update = (patch: Partial<Overview>) =>
    store
      .getState()
      .updateSections({ overview: { ...store.getState().document.overview, ...patch } });
  const updateRepo = (patch: Partial<Overview["repository"]>) =>
    update({ repository: { ...overview.repository, ...patch } });
  const tooLong = (max: number) => (text: string) =>
    text.length > max ? `At most ${max} characters` : null;

  return (
    <SectionPage
      editable
      title="Overview"
      description="What you are building and how it is organised. Agents read this first."
    >
      <TextField
        label="Summary"
        multiline
        value={overview.summary}
        validate={tooLong(10_000)}
        onCommit={(summary) => update({ summary })}
      />
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
