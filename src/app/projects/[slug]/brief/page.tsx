import { Suspense } from "react";

import { BriefView } from "@/components/sections/brief-view";
import { requirePagePrincipal } from "@/server/auth/current";
import { getDb } from "@/server/db/client";
import { listVersions } from "@/server/services/versions";

async function Brief({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const versions = await listVersions(getDb(), slug, await requirePagePrincipal());
  return <BriefView versions={versions.map((v) => ({ version: v.version, label: v.label }))} />;
}

export default function BriefPage({ params }: PageProps<"/projects/[slug]/brief">) {
  return (
    <Suspense fallback={<p className="p-6 text-muted-foreground">Loading…</p>}>
      <Brief params={params} />
    </Suspense>
  );
}
