/**
 * High-resolution vector & raster image export for XYFlow architecture canvas.
 * Client-side component utility.
 */
import { getNodesBounds, getViewportForBounds, type Node } from "@xyflow/react";
import { toPng, toSvg } from "html-to-image";

export type ExportBackground = "light" | "dark" | "transparent";

export const EXPORT_BACKGROUNDS: Record<ExportBackground, { label: string; swatch: string }> = {
  light: { label: "White", swatch: "#ffffff" },
  dark: { label: "Dark", swatch: "#09090b" },
  transparent: { label: "Transparent", swatch: "transparent" },
};

export interface RenderCanvasOptions {
  viewportElement: HTMLElement;
  nodes: Node[];
  format?: "png" | "svg";
  background?: ExportBackground;
}

/**
 * Renders the canvas to a data URL (for download or in-dialog preview).
 * Transparent omits the background so PNGs keep their alpha channel.
 */
export async function renderCanvasDataUrl({
  viewportElement,
  nodes,
  format = "png",
  background = "dark",
}: RenderCanvasOptions): Promise<string> {
  if (nodes.length === 0) {
    throw new Error("Cannot export an empty canvas.");
  }

  const bounds = getNodesBounds(nodes);
  const padding = 80;
  const imageWidth = Math.max(1200, Math.ceil(bounds.width + padding * 2));
  const imageHeight = Math.max(800, Math.ceil(bounds.height + padding * 2));

  // Frame all nodes nicely inside the export viewport
  const viewport = getViewportForBounds(bounds, imageWidth, imageHeight, 0.4, 2, padding);

  const backgroundColor =
    background === "transparent" ? undefined : EXPORT_BACKGROUNDS[background].swatch;

  const options = {
    ...(backgroundColor ? { backgroundColor } : {}),
    width: imageWidth,
    height: imageHeight,
    pixelRatio: 2, // 2x Retina resolution for razor sharp rendering
    style: {
      width: `${imageWidth}px`,
      height: `${imageHeight}px`,
      transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
    },
    filter: (node: HTMLElement) => {
      // Exclude minimap, panels and interactive helper controls from export
      const cl = node.classList;
      if (!cl) return true;
      if (cl.contains("react-flow__minimap")) return false;
      if (cl.contains("react-flow__panel")) return false;
      return true;
    },
  };

  let finalDataUrl =
    format === "svg"
      ? await toSvg(viewportElement, options)
      : await toPng(viewportElement, options);

  // Security sanitization for vector SVG exports (defense-in-depth against Stored XSS)
  if (format === "svg" && finalDataUrl.startsWith("data:image/svg+xml")) {
    const rawSvg = decodeURIComponent(
      finalDataUrl.replace(/^data:image\/svg\+xml(?:;charset=[^,]+)?,/, ""),
    );
    const sanitizedSvg = rawSvg
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
      .replace(/\s+on\w+\s*=\s*(["']).*?\1/gi, "")
      .replace(/javascript:/gi, "");
    finalDataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(sanitizedSvg)}`;
  }

  return finalDataUrl;
}

export interface ExportImageOptions extends RenderCanvasOptions {
  fileName?: string;
}

export function downloadDataUrl(dataUrl: string, fileName: string): void {
  const safeFileName = fileName.replace(/[^a-zA-Z0-9_\-.]/g, "_");
  const link = document.createElement("a");
  link.download = safeFileName;
  link.href = dataUrl;
  document.body.append(link);
  link.click();
  link.remove();
}

export async function exportCanvasImage({
  fileName = "architecture",
  format = "png",
  ...renderOptions
}: ExportImageOptions): Promise<void> {
  const dataUrl = await renderCanvasDataUrl({ format, ...renderOptions });
  downloadDataUrl(dataUrl, `${fileName}.${format}`);
}
