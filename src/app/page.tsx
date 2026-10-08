// PROTOTYPE — Phase 4 replaces this page (§11.2). Kept to prove the
// Cache Components data pattern: runtime DB reads live inside <Suspense>.
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";

import { getDb } from "@/server/db/client";
import { listProjects } from "@/server/services/projects";

async function ProjectList() {
  await connection();
  const projects = await listProjects(getDb());
  if (projects.length === 0) return <p className="text-muted-foreground">No projects yet.</p>;
  return (
    <ul className="space-y-2">
      {projects.map((p) => (
        <li key={p.id}>
          <Link className="underline" href={`/projects/${p.slug}`}>
            {p.name}
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-3xl p-8">
      <h1 className="mb-6 font-heading text-2xl font-semibold">Projects</h1>
      <Suspense fallback={<p className="text-muted-foreground">Loading…</p>}>
        <ProjectList />
      </Suspense>
    </main>
  );
}
