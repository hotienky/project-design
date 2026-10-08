import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DELETE, GET, POST } from "@/app/api/mcp/route";
import { PUT as putDesign } from "@/app/api/projects/[slug]/design/route";
import { getDb } from "@/server/db/client";
import { createProject, getProject } from "@/server/services/projects";
import { createToken } from "@/server/services/tokens";
import { resetDb } from "./helpers/db";
import { syntheticDesign } from "./helpers/synthetic-design";

vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  connection: async () => {},
}));

const routeFetch = async (input: string | URL | Request, init?: RequestInit) => {
  const request = new Request(input, init);
  const handler = { GET, POST, DELETE }[request.method as "GET" | "POST" | "DELETE"];
  return handler ? handler(request) : new Response(null, { status: 405 });
};

/**
 * Timings for a ~500-node design (16 services × 31 nodes). They are logged so regressions are
 * visible; the assertions are 10× the targets (brief < 200 ms, save < 300 ms) so a slow CI
 * machine does not make the suite flaky while an accidental O(n²) still fails it.
 */
describe("performance with a 500-node design", () => {
  beforeEach(resetDb);
  const db = getDb();
  const design = syntheticDesign(16);

  it("renders the brief and saves the draft quickly", async () => {
    expect(design.nodes).toHaveLength(496);
    await createProject(db, { name: "Big", slug: "big", document: design as never });
    const { token } = await createToken(db, { name: "perf" });
    const client = new Client({ name: "perf", version: "0.0.0" });
    await client.connect(
      new StreamableHTTPClientTransport(new URL("http://localhost:3000/api/mcp"), {
        fetch: routeFetch,
        requestInit: { headers: { Authorization: `Bearer ${token}` } },
      }),
    );

    await client.callTool({ name: "get_project_brief", arguments: {} }); // warm-up
    const t0 = performance.now();
    const brief = await client.callTool({ name: "get_project_brief", arguments: {} });
    const briefMs = performance.now() - t0;
    const text = (brief.content as { text: string }[])[0]!.text;
    expect(text.length).toBeGreaterThan(50_000);

    const row = await getProject(db, "big");
    const body = JSON.stringify({ revision: row.revision, document: row.document });
    const t1 = performance.now();
    const response = await putDesign(
      new Request("http://localhost:3000/api/projects/big/design", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body,
      }),
      { params: Promise.resolve({ slug: "big" }) },
    );
    const saveMs = performance.now() - t1;
    expect(response.status).toBe(200);

    console.info(
      `[perf] ${design.nodes.length} nodes: get_project_brief ${briefMs.toFixed(0)} ms (${(text.length / 1024).toFixed(0)} KB), design PUT ${saveMs.toFixed(0)} ms (${(body.length / 1024).toFixed(0)} KB)`,
    );
    expect(briefMs).toBeLessThan(2000);
    expect(saveMs).toBeLessThan(3000);
    await client.close();
  });
});
