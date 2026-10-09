import { Suspense } from "react";

import { VersionsTable } from "@/components/sections/versions-table";
import { requirePagePrincipal } from "@/server/auth/current";
import { getDb } from "@/server/db/client";
import { listVersions } from "@/server/services/versions";

async function Versions({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const versions = await listVersions(getDb(), slug, await requirePagePrincipal());
  return (
    <VersionsTable
      versions={versions.map((v) => ({
        version: v.version,
        label: v.label,
        notes: v.notes,
        nodeCount: v.nodeCount,
        createdAt: v.createdAt.toISOString(),
      }))}
    />
  );
}

export default function VersionsPage({ params }: PageProps<"/projects/[slug]/versions">) {
  return (
    <Suspense fallback={<p className="p-6 text-muted-foreground">Loading versions…</p>}>
      <Versions params={params} />
    </Suspense>
  );
}
