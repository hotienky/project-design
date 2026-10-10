"use client";

import { Check, Copy, Download, FileJson, FileText, Loader2, TableProperties } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { useDesigner, useProjectMeta, useSaveNow } from "@/components/designer/store-provider";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { dataModel, toSqlDdl } from "@/lib/design/datamodel";
import { indexDesign } from "@/lib/design/graph";
import { toDiagramCode, type DiagramCodeType } from "@/lib/design/mermaid";
import { useCanvasUi } from "@/stores/canvas-ui-store";
import {
  downloadDataUrl,
  EXPORT_BACKGROUNDS,
  type ExportBackground,
} from "@/components/designer/export-image";

type ExportFormat = "png" | "svg" | "pdf" | "mmd";

const FORMATS: { id: ExportFormat; title: string; hint: string }[] = [
  { id: "png", title: "PNG", hint: "High quality raster image" },
  { id: "svg", title: "SVG", hint: "Scalable vector graphics" },
  { id: "pdf", title: "PDF", hint: "Portable document format" },
  { id: "mmd", title: "MMD", hint: "Mermaid diagram-as-code for AI" },
];

const MMD_TYPES: { id: DiagramCodeType; title: string }[] = [
  { id: "architecture", title: "Architecture" },
  { id: "sequence", title: "Sequence" },
  { id: "er", title: "Data model" },
];

function downloadText(text: string, fileName: string, mime: string): void {
  const safe = fileName.replace(/[^a-zA-Z0-9_\-.]/g, "_");
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const link = document.createElement("a");
  link.download = safe;
  link.href = url;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Prints a rendered image to PDF through the browser print dialog. */
function printToPdf(dataUrl: string, title: string): void {
  const win = window.open("", "_blank", "width=1000,height=800");
  if (!win) {
    toast.error("Popup blocked: allow popups to export PDF");
    return;
  }
  win.document.write(
    `<html><head><title>${title}</title>` +
      `<style>@page{size:A4 landscape;margin:10mm}body{margin:0;display:flex;align-items:center;justify-content:center}img{max-width:100%;height:auto}</style>` +
      `</head><body><img src="${dataUrl}" onload="window.print()"/></body></html>`,
  );
  win.document.close();
}

export function ExportDiagramDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { name, slug } = useProjectMeta();
  const document = useDesigner((s) => s.document);
  const saveNow = useSaveNow();
  const renderPreview = useCanvasUi((s) => s.renderPreviewHandler);
  const [format, setFormat] = useState<ExportFormat>("png");
  const [background, setBackground] = useState<ExportBackground>("light");
  const [mmdType, setMmdType] = useState<DiagramCodeType>("architecture");
  const [direction, setDirection] = useState<"LR" | "TD">("LR");
  const [includeNotes, setIncludeNotes] = useState(false);
  const [renderedPreview, setRenderedPreview] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [copiedMmd, setCopiedMmd] = useState<string | null>(null);

  const fileName = `${slug}-architecture`;

  const mmd = useMemo(
    () =>
      format === "mmd"
        ? toDiagramCode({ name, slug }, document, {
            type: mmdType,
            direction,
            includeNotes,
          })
        : null,
    [format, mmdType, direction, includeNotes, name, slug, document],
  );

  const copied = copiedMmd === mmd && mmd !== null;

  // Live image preview from the mounted canvas (the dialog also opens from
  // non-canvas tabs, where no preview is available).
  useEffect(() => {
    if (!open || format === "mmd" || !renderPreview) {
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      setPreviewLoading(true);
      void renderPreview("png", background)
        .then((url) => {
          if (!cancelled) {
            setRenderedPreview(url);
            setPreviewLoading(false);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setRenderedPreview(null);
            setPreviewLoading(false);
          }
        });
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [open, format, background, renderPreview]);

  const preview = open && format !== "mmd" && renderPreview ? renderedPreview : null;

  const handleExport = async () => {
    if (format === "mmd") {
      if (!mmd) return;
      downloadText(mmd, `${fileName}.mmd`, "text/vnd.mermaid;charset=utf-8");
      toast.success("Exported MMD diagram-as-code");
      return;
    }
    if (!renderPreview) {
      toast.error("Open the Canvas tab to export images");
      return;
    }
    setExporting(true);
    try {
      if (format === "pdf") {
        const url = await renderPreview("png", background === "transparent" ? "light" : background);
        if (!url) throw new Error("Could not render the canvas");
        printToPdf(url, `${fileName}.pdf`);
        toast.success("Opened print dialog: choose Save as PDF");
      } else {
        const url = await renderPreview(format, background);
        if (!url) throw new Error("Could not render the canvas");
        downloadDataUrl(url, `${fileName}.${format}`);
        toast.success(`Exported ${format.toUpperCase()} successfully!`);
      }
    } catch (err) {
      toast.error(`Export failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setExporting(false);
    }
  };

  const copyMmd = async () => {
    if (!mmd) return;
    try {
      await navigator.clipboard.writeText(mmd);
      setCopiedMmd(mmd);
      toast.success("Diagram code copied to clipboard");
    } catch {
      toast.error("Failed to copy to clipboard");
    }
  };

  // The server exports what it has saved, so flush pending edits first.
  const downloadSaved = async (path: string) => {
    await saveNow();
    const link = window.document.createElement("a");
    link.href = `/api/projects/${slug}/${path}`;
    link.download = "";
    window.document.body.append(link);
    link.click();
    link.remove();
  };

  const copySqlDdl = async () => {
    try {
      const ddl = toSqlDdl(dataModel(indexDesign(document)));
      await navigator.clipboard.writeText(ddl);
      toast.success("SQL DDL schema copied to clipboard");
    } catch {
      toast.error("Failed to copy to clipboard");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Export diagram</DialogTitle>
          <DialogDescription>
            Images for sharing, MMD diagram-as-code for AI agents to redraw without drag-and-drop.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 md:grid-cols-[240px_1fr]">
          <div className="flex flex-col gap-4">
            <div>
              <p className="mb-2 text-sm font-medium">Export format</p>
              <div role="radiogroup" aria-label="Export format" className="flex flex-col gap-2">
                {FORMATS.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    role="radio"
                    aria-checked={format === f.id}
                    onClick={() => setFormat(f.id)}
                    className={cn(
                      "rounded-lg border p-3 text-left transition-colors",
                      format === f.id
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-muted-foreground/40",
                    )}
                  >
                    <span className="block text-sm font-semibold">{f.title}</span>
                    <span className="block text-xs text-muted-foreground">{f.hint}</span>
                  </button>
                ))}
              </div>
            </div>

            {format === "mmd" ? (
              <div className="flex flex-col gap-3">
                <div>
                  <p className="mb-2 text-sm font-medium">Diagram</p>
                  <div className="flex flex-wrap gap-1.5">
                    {MMD_TYPES.map((t) => (
                      <Button
                        key={t.id}
                        type="button"
                        variant={mmdType === t.id ? "secondary" : "ghost"}
                        size="sm"
                        aria-pressed={mmdType === t.id}
                        onClick={() => setMmdType(t.id)}
                      >
                        {t.title}
                      </Button>
                    ))}
                  </div>
                </div>
                {mmdType === "architecture" && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-muted-foreground">Direction</span>
                    {(["LR", "TD"] as const).map((d) => (
                      <Button
                        key={d}
                        type="button"
                        variant={direction === d ? "secondary" : "ghost"}
                        size="sm"
                        aria-pressed={direction === d}
                        onClick={() => setDirection(d)}
                      >
                        {d === "LR" ? "Left → right" : "Top ↓ down"}
                      </Button>
                    ))}
                  </div>
                )}
                <Label className="flex cursor-pointer items-center gap-2 text-sm font-normal">
                  <Checkbox
                    checked={includeNotes}
                    onCheckedChange={(v) => setIncludeNotes(v === true)}
                  />
                  Include notes
                </Label>
              </div>
            ) : (
              <div>
                <p className="mb-2 text-sm font-medium">Background color</p>
                <div className="flex gap-2">
                  {(Object.keys(EXPORT_BACKGROUNDS) as ExportBackground[]).map((b) => (
                    <button
                      key={b}
                      type="button"
                      title={EXPORT_BACKGROUNDS[b].label}
                      aria-label={`Background ${EXPORT_BACKGROUNDS[b].label}`}
                      aria-pressed={background === b}
                      onClick={() => setBackground(b)}
                      className={cn(
                        "size-8 rounded-md border transition-all",
                        background === b
                          ? "border-primary ring-2 ring-primary/30"
                          : "border-border hover:border-muted-foreground/40",
                      )}
                      style={{
                        background:
                          b === "transparent"
                            ? "repeating-conic-gradient(#ccc 0 25%, #fff 0 50%) 0 0 / 12px 12px"
                            : EXPORT_BACKGROUNDS[b].swatch,
                      }}
                    />
                  ))}
                </div>
              </div>
            )}

            <div>
              <p className="mb-2 text-sm font-medium">Project data</p>
              <div className="flex flex-col gap-1.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="justify-start"
                  onClick={() => void downloadSaved("export?version=draft")}
                >
                  <FileJson /> Design JSON
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="justify-start"
                  onClick={() => void downloadSaved("brief?version=draft")}
                >
                  <FileText /> Markdown brief
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="justify-start"
                  onClick={copySqlDdl}
                >
                  <TableProperties /> Copy SQL DDL
                </Button>
              </div>
            </div>
          </div>

          <div className="flex min-h-0 flex-col">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-medium">Preview</p>
              {format === "mmd" && (
                <Button type="button" variant="ghost" size="sm" onClick={copyMmd}>
                  {copied ? <Check /> : <Copy />}
                  {copied ? "Copied" : "Copy code"}
                </Button>
              )}
            </div>
            <ScrollArea className="min-h-64 flex-1 rounded-lg border bg-muted/30">
              {format === "mmd" ? (
                <pre className="p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap">
                  {mmd}
                </pre>
              ) : previewLoading ? (
                <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
                  <Loader2 className="mr-2 size-4 animate-spin" /> Rendering preview…
                </div>
              ) : preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview} alt="Diagram preview" className="h-auto w-full" />
              ) : (
                <div className="flex h-64 items-center justify-center p-6 text-center text-sm text-muted-foreground">
                  {renderPreview
                    ? "Could not render a preview of this canvas."
                    : "Open the Canvas tab to preview and export images. MMD code works from any tab."}
                </div>
              )}
            </ScrollArea>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleExport}
            disabled={exporting || (format !== "mmd" && !renderPreview)}
          >
            {exporting ? <Loader2 className="animate-spin" /> : <Download />}
            Export
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
