"use client";

import { useId, type ReactNode, type Ref } from "react";
import type { ZodType } from "zod";

import { useDebouncedCommit } from "@/components/designer/inspector/use-debounced-commit";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

/** A validator for TextField built from a zod schema: returns the first issue's message. */
export const validateWith =
  (schema: ZodType) =>
  (value: unknown): string | null => {
    const result = schema.safeParse(value);
    return result.success ? null : (result.error.issues[0]?.message ?? "Invalid value");
  };

export function Section({
  title,
  children,
  className,
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("grid gap-3 border-b px-4 py-3", className)}>
      <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{title}</h3>
      {children}
    </section>
  );
}

export function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
}: {
  label: string;
  htmlFor?: string;
  error?: string | null;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-1">
      <Label htmlFor={htmlFor} className="text-xs">
        {label}
      </Label>
      {children}
      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

export function TextField({
  label,
  value,
  onCommit,
  multiline,
  validate,
  mono,
  placeholder,
  hint,
  inputRef,
  compact,
  ariaLabel,
}: {
  label: string;
  value: string;
  onCommit: (value: string) => void;
  multiline?: boolean;
  validate?: (value: string) => string | null;
  mono?: boolean;
  placeholder?: string;
  hint?: string;
  inputRef?: Ref<HTMLInputElement>;
  /** No label row (the caller supplies context); the label becomes the aria-label. */
  compact?: boolean;
  ariaLabel?: string;
}) {
  const id = useId();
  const draft = useDebouncedCommit(value, onCommit, { validate });
  const shared = {
    id,
    value: draft.value,
    placeholder,
    "aria-label": compact ? (ariaLabel ?? label) : undefined,
    "aria-invalid": draft.error ? true : undefined,
    className: cn(mono && "font-mono text-xs"),
    onBlur: draft.flush,
  };
  const control = multiline ? (
    <Textarea {...shared} rows={3} onChange={(e) => draft.setValue(e.target.value)} />
  ) : (
    <Input
      {...shared}
      ref={inputRef}
      onChange={(e) => draft.setValue(e.target.value)}
      onKeyDown={(e) => {
        if (e.key !== "Enter") return;
        e.preventDefault(); // don't submit an enclosing dialog form with the not-yet-committed value
        draft.flush();
      }}
    />
  );
  if (compact) {
    return (
      <div className="grid gap-0.5">
        {control}
        {draft.error && (
          <p role="alert" className="text-xs text-destructive">
            {draft.error}
          </p>
        )}
      </div>
    );
  }
  return (
    <Field label={label} htmlFor={id} error={draft.error} hint={hint}>
      {control}
    </Field>
  );
}

/** A number or empty (null). */
export function NumberField({
  label,
  value,
  onCommit,
  min,
  max,
  compact,
}: {
  label: string;
  value: number | null;
  onCommit: (value: number | null) => void;
  min?: number;
  max?: number;
  compact?: boolean;
}) {
  return (
    <TextField
      label={label}
      compact={compact}
      value={value === null ? "" : String(value)}
      validate={(text) => {
        if (text.trim() === "") return null;
        const n = Number(text);
        if (!Number.isInteger(n)) return "Enter a whole number";
        if (min !== undefined && n < min) return `Must be at least ${min}`;
        if (max !== undefined && n > max) return `Must be at most ${max}`;
        return null;
      }}
      onCommit={(text) => onCommit(text.trim() === "" ? null : Number(text))}
    />
  );
}

export function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
  compact,
  disabled,
  hint,
}: {
  label: string;
  value: T;
  options: readonly (T | { value: T; label: string; disabled?: boolean })[];
  onChange: (value: T) => void;
  compact?: boolean;
  disabled?: boolean;
  hint?: string;
}) {
  const id = useId();
  const items = options.map((o) => (typeof o === "string" ? { value: o, label: o } : o));
  const control = (
    <Select value={value} onValueChange={(v) => onChange(v as T)} disabled={disabled}>
      <SelectTrigger
        id={id}
        className="w-full"
        size={compact ? "sm" : "default"}
        aria-label={compact ? label : undefined}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {items.map((o) => (
          <SelectItem key={o.value} value={o.value} disabled={"disabled" in o ? o.disabled : false}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
  if (compact) return control;
  return (
    <Field label={label} htmlFor={id} hint={hint}>
      {control}
    </Field>
  );
}

export function SwitchField({
  label,
  checked,
  onChange,
  compact,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  compact?: boolean;
}) {
  const id = useId();
  return (
    <div className="flex items-center gap-2">
      <Switch
        id={id}
        size={compact ? "sm" : "default"}
        checked={checked}
        onCheckedChange={onChange}
      />
      <Label htmlFor={id} className="text-xs">
        {label}
      </Label>
    </div>
  );
}
