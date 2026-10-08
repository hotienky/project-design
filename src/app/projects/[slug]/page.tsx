// PROTOTYPE — Phase 5 replaces this page with the designer (§12).
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { DesignerCanvas } from "@/components/designer/canvas";
import { getDb } from "@/server/db/client";
import { getProjectBySlug } from "@/server/services/projects";

async function Designer({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const project = await getProjectBySlug(getDb(), slug);
  if (!project) notFound();
  return <DesignerCanvas document={project.document} />;
}

export default function ProjectPage({ params }: PageProps<"/projects/[slug]">) {
  return (
    <div className="h-dvh w-full">
      <Suspense fallback={<p className="p-8 text-muted-foreground">Loading design…</p>}>
        <Designer params={params} />
      </Suspense>
    </div>
  );
}
