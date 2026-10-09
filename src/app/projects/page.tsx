import { FolderOpen } from "lucide-react";
import { connection } from "next/server";
import { Suspense } from "react";

import { ImportButton } from "@/components/projects/import-button";
import { NewProjectDialog } from "@/components/projects/new-project-dialog";
import { ProjectCard } from "@/components/projects/project-card";
import { getDb } from "@/server/db/client";
import { listProjects } from "@/server/services/projects";

function Actions() {
  return (
    <div className="flex items-center gap-2">
      <ImportButton />
      <NewProjectDialog />
    </div>
  );
}

async function ProjectGrid() {
  await connection();
  const projects = await listProjects(getDb());
  if (projects.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-20 text-center">
        <FolderOpen className="size-8 text-muted-foreground" aria-hidden />
        <p className="font-heading text-lg font-medium">No designs yet</p>
        <p className="text-sm text-muted-foreground">
          Start a blank design, try the example, or import a file.
        </p>
        <Actions />
      </div>
    );
  }
  return (
    <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {projects.map((p) => (
        <li key={p.slug}>
          <ProjectCard
            project={{
              slug: p.slug,
              name: p.name,
              description: p.description,
              revision: p.revision,
              latestVersion: p.latestVersion,
              nodeCount: p.nodeCount,
              updatedAt: p.updatedAt.toISOString(),
            }}
          />
        </li>
      ))}
    </ul>
  );
}

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-6xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-heading text-xl font-semibold">Projects</h1>
        <Actions />
      </div>
      <Suspense fallback={<p className="text-muted-foreground">Loading…</p>}>
        <ProjectGrid />
      </Suspense>
    </main>
  );
}
