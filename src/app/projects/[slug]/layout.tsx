import { notFound } from "next/navigation";
import { Suspense } from "react";

import { DesignerStoreProvider } from "@/components/designer/store-provider";
import { ProjectHeader } from "@/components/designer/project-header";
import { getDb } from "@/server/db/client";
import { env } from "@/server/env";
import { getProjectBySlug } from "@/server/services/projects";

async function ProjectShell({
  params,
  children,
}: {
  params: Promise<{ slug: string }>;
  children: React.ReactNode;
}) {
  const { slug } = await params;
  const project = await getProjectBySlug(getDb(), slug);
  if (!project) notFound();
  return (
    <DesignerStoreProvider
      key={project.slug}
      meta={{ name: project.name, slug: project.slug, description: project.description }}
      appUrl={env().APP_URL}
      initial={{ document: project.document, revision: project.revision }}
    >
      <ProjectHeader />
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </DesignerStoreProvider>
  );
}

export default function ProjectLayout({ children, params }: LayoutProps<"/projects/[slug]">) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Suspense fallback={<p className="p-8 text-muted-foreground">Loading design…</p>}>
        <ProjectShell params={params}>{children}</ProjectShell>
      </Suspense>
    </div>
  );
}
