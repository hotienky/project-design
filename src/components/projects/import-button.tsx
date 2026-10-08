"use client";

import { Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

interface Issue {
  message?: string;
}

export function ImportButton() {
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function upload(file: File) {
    setBusy(true);
    try {
      const response = await fetch("/api/projects/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: await file.text(),
      });
      const body = await response.json().catch(() => null);
      if (response.ok) {
        toast.success("Design imported");
        router.push(`/projects/${body.slug}`);
        return;
      }
      const details = Array.isArray(body?.error?.details) ? (body.error.details as Issue[]) : [];
      const lines = details
        .slice(0, 3)
        .map((i) => i.message)
        .filter(Boolean);
      toast.error(body?.error?.message ?? "Import failed", {
        description: lines.length > 0 ? lines.join("\n") : undefined,
      });
    } catch {
      toast.error("Import failed");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <>
      <input
        ref={input}
        type="file"
        accept=".json,application/json"
        className="hidden"
        aria-label="Import design file"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void upload(file);
        }}
      />
      <Button variant="outline" size="sm" disabled={busy} onClick={() => input.current?.click()}>
        <Upload /> {busy ? "Importing…" : "Import"}
      </Button>
    </>
  );
}
