import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { beforeEach, describe, expect, it } from "vitest";

import { DELETE, GET, POST } from "@/app/api/mcp/route";
import { renderBrief } from "@/lib/design/brief";
import { teamTasksDesign } from "@/lib/design/examples/team-tasks";
import { parseDesign } from "@/lib/design/integrity";
import { getDb } from "@/server/db/client";
import { createProject, getProject, saveDraft } from "@/server/services/projects";
import { createToken } from "@/server/services/tokens";
import { publishVersion } from "@/server/services/versions";
import { resetDb } from "./helpers/db";

const MCP_URL = new URL("http://localhost:3000/api/mcp");
const db = getDb();

const routeFetch = async (input: string | URL | Request, init?: RequestInit) => {
  const request = new Request(input, init);
  const handler = { GET, POST, DELETE }[request.method as "GET" | "POST" | "DELETE"];
  return handler ? handler(request) : new Response(null, { status: 405 });
};

async function connect(token: string) {
  const client = new Client({ name: "test", version: "0.0.0" });
  await client.connect(
    new StreamableHTTPClientTransport(MCP_URL, {
      fetch: routeFetch,
      requestInit: { headers: { Authorization: `Bearer ${token}` } },
    }),
  );
  return client;
}

type Result = Awaited<ReturnType<Client["callTool"]>>;
const raw = (r: Result) => (r.content as { type: string; text: string }[])[0]!.text;
const json = (r: Result) => JSON.parse(raw(r));

async function seed() {
  const project = await createProject(db, {
    name: "Team Tasks",
    description: "Task tracker for small teams, with email notifications.",
    document: teamTasksDesign,
  });
  const { token } = await createToken(db, { name: "all" });
  return { project, client: await connect(token) };
}

const call = (client: Client, name: string, args: Record<string, unknown> = {}) =>
  client.callTool({ name, arguments: args });

describe("MCP tools", () => {
  beforeEach(resetDb);

  it("get_project_brief equals the renderer's output", async () => {
    const { client } = await seed();
    const brief = raw(await call(client, "get_project_brief"));
    expect(brief).toBe(
      renderBrief({
        project: {
          name: "Team Tasks",
          slug: "team-tasks",
          description: "Task tracker for small teams, with email notifications.",
        },
        document: parseDesign(teamTasksDesign),
        revision: 1,
        version: null,
        statuses: new Map(),
      }),
    );
    await client.close();
  });

  it("serves every read tool against the example", async () => {
    const { client } = await seed();

    const schema = json(await call(client, "get_design_schema"));
    expect(Object.keys(schema.nodeKinds)).toHaveLength(10);
    expect(schema.guide).toContain("Containment");
    expect(schema.jsonSchema.type).toBe("object");

    const design = json(await call(client, "get_project_design"));
    expect(design).toMatchObject({ project: { slug: "team-tasks" }, revision: 1, version: null });

    const services = json(await call(client, "list_components", { kind: "service" }));
    expect(services.map((c: { id: string }) => c.id)).toEqual([
      "svc_web",
      "svc_api",
      "svc_notifier",
    ]);
    const children = json(await call(client, "list_components", { parentId: "svc_api" }));
    expect(children).toHaveLength(4);

    const component = json(await call(client, "get_component", { id: "Task use cases" }));
    expect(component.component.id).toBe("mod_usecases");
    expect(component.path).toBe("API › Application › Task use cases");
    expect(component.parent.id).toBe("lyr_app");
    expect(component.relations.outgoing[0]).toMatchObject({
      kind: "depends_on",
      target: { id: "mod_domain" },
    });
    expect(component.relations.incoming[0].source.id).toBe("mod_routes");
    expect(component.allowedLayerDependencies).toEqual([{ id: "lyr_domain", name: "Domain" }]);
    expect(component.stack.map((s: { id: string }) => s.id)).toContain("stk_api");
    expect(component.conventions.map((c: { id: string }) => c.id)).toContain("cnv_errors");
    expect(component.status).toBeNull();

    const openapi = json(await call(client, "get_api_contract", { api: "Tasks REST API" }));
    expect(openapi.openapi).toBe("3.1.0");
    const apiJson = json(
      await call(client, "get_api_contract", { api: "api_rest", format: "json" }),
    );
    expect(apiJson.implementedBy[0].id).toBe("svc_api");
    expect(apiJson.consumedBy[0].id).toBe("mod_web_tasks");
    expect(apiJson.entities.map((e: { id: string }) => e.id)).toEqual(["ent_task"]);

    const model = json(await call(client, "get_data_model"));
    expect(model.datastores[0].entities).toHaveLength(3);
    const mermaid = raw(
      await call(client, "get_data_model", { datastore: "Main database", format: "mermaid" }),
    );
    expect(mermaid.startsWith("erDiagram")).toBe(true);

    const plan = json(await call(client, "get_build_plan"));
    expect(plan.steps[0].id).toBe("setup");

    const validation = json(await call(client, "validate_design"));
    expect(validation).toMatchObject({ errors: 0, warnings: 0 });
    await client.close();
  });

  it("reports ambiguous and unknown references as tool errors", async () => {
    const { project, client } = await seed();
    await createProject(db, { name: "Other", document: { schemaVersion: 1 } });

    const several = await call(client, "get_project_brief");
    expect(several.isError).toBe(true);
    expect(raw(several)).toBe("Several projects are available: other, team-tasks. Pass project.");

    const unknown = await call(client, "get_project_brief", { project: "nope" });
    expect(unknown.isError).toBe(true);
    expect(raw(unknown)).toContain('Unknown project "nope". Available: other, team-tasks');

    const missing = await call(client, "get_component", { project: project.slug, id: "ghost" });
    expect(missing.isError).toBe(true);

    // Two nodes share a name, so a name lookup must list candidates.
    const row = await getProject(db, project.slug);
    const doc = structuredClone(row.document);
    doc.nodes.push({
      ...doc.nodes.find((n) => n.id === "mod_domain")!,
      id: "mod_dup",
      parentId: "lyr_app",
    });
    await saveDraft(db, project.slug, { revision: row.revision, document: doc });
    const ambiguous = await call(client, "get_component", {
      project: project.slug,
      id: "Task model",
    });
    expect(ambiguous.isError).toBe(true);
    expect(raw(ambiguous)).toContain(
      "Task model [mod_domain] (module), Task model [mod_dup] (module)",
    );

    const wrongKind = await call(client, "get_api_contract", { project: project.slug, api: "API" });
    expect(wrongKind.isError).toBe(true);
    const restOk = await call(client, "get_api_contract", {
      project: project.slug,
      api: "api_rest",
    });
    expect(restOk.isError).toBeFalsy();
    await client.close();
  });

  it("suggests json for a non-REST API", async () => {
    const { project, client } = await seed();
    const row = await getProject(db, project.slug);
    const doc = structuredClone(row.document);
    const api = doc.nodes.find((n) => n.id === "api_rest")!;
    if (api.kind === "api") api.data.style = "graphql";
    await saveDraft(db, project.slug, { revision: row.revision, document: doc });
    const result = await call(client, "get_api_contract", { api: "api_rest" });
    expect(result.isError).toBe(true);
    expect(raw(result)).toContain('format "json"');
    await client.close();
  });

  it('version "latest" fails before publishing and pins the snapshot afterwards', async () => {
    const { project, client } = await seed();
    const before = await call(client, "get_project_brief", { version: "latest" });
    expect(before.isError).toBe(true);
    expect(raw(before)).toBe('No published version yet; use version "draft"');

    await publishVersion(db, project.slug, { label: "first" });
    const row = await getProject(db, project.slug);
    const doc = structuredClone(row.document);
    doc.overview.summary = "Changed after publishing";
    await saveDraft(db, project.slug, { revision: row.revision, document: doc });

    const latest = raw(await call(client, "get_project_brief", { version: "latest" }));
    expect(latest).toContain("version 1 (first)");
    expect(latest).not.toContain("Changed after publishing");
    expect(raw(await call(client, "get_project_brief"))).toContain("Changed after publishing");
    expect(raw(await call(client, "get_project_brief", { version: 1 }))).toContain(
      "version 1 (first)",
    );
    await client.close();
  });

  it("get_design_changes reports edits since a version", async () => {
    const { project, client } = await seed();
    await publishVersion(db, project.slug, {});
    const row = await getProject(db, project.slug);
    const doc = structuredClone(row.document);
    doc.nodes = doc.nodes.filter((n) => n.id !== "nte_scope");
    await saveDraft(db, project.slug, { revision: row.revision, document: doc });

    const changes = json(await call(client, "get_design_changes", { from: 1 }));
    expect(changes.diff.isEmpty).toBe(false);
    expect(changes.summary).toContain("- Removed note **Scope** [nte_scope]");
    expect(json(await call(client, "get_design_changes", { from: 1, to: 1 })).diff.isEmpty).toBe(
      true,
    );
    const missing = await call(client, "get_design_changes", { from: 9 });
    expect(missing.isError).toBe(true);
    await client.close();
  });

  it("set_component_status shows up in the plan, the brief and get_component", async () => {
    const { client } = await seed();
    const ok = json(
      await call(client, "set_component_status", { id: "svc_api", status: "done", note: "built" }),
    );
    expect(ok).toEqual({ ok: true, id: "svc_api", status: "done" });

    const plan = json(await call(client, "get_build_plan"));
    expect(plan.steps.find((s: { id: string }) => s.id === "svc_api").status).toBe("done");
    expect(raw(await call(client, "get_project_brief"))).toContain("status: done");
    const component = json(await call(client, "get_component", { id: "svc_api" }));
    expect(component.status).toMatchObject({ status: "done", note: "built" });

    const bad = await call(client, "set_component_status", { id: "nope", status: "done" });
    expect(bad.isError).toBe(true);
    await client.close();
  });

  it("lets a scoped token omit the project", async () => {
    const { project } = await seed();
    await createProject(db, { name: "Other", document: { schemaVersion: 1 } });
    const scoped = await createToken(db, { name: "scoped", projectId: project.id });
    const client = await connect(scoped.token);
    expect(raw(await call(client, "get_project_brief"))).toContain("# Team Tasks — design brief");
    const other = await call(client, "get_project_brief", { project: "other" });
    expect(other.isError).toBe(true);
    await client.close();
  });
});

describe("MCP prompts and resources", () => {
  beforeEach(resetDb);

  it("lists prompts and substitutes the project", async () => {
    const { client } = await seed();
    const prompts = await client.listPrompts();
    expect(prompts.prompts.map((p) => p.name).sort()).toEqual([
      "implement_design",
      "review_against_design",
      "sync_design_changes",
    ]);

    const implement = await client.getPrompt({ name: "implement_design", arguments: {} });
    const text = (implement.messages[0]!.content as { text: string }).text;
    expect(text).toContain('implementing the project "Team Tasks" (`team-tasks`)');
    expect(text).toContain("get_build_plan");

    await createProject(db, { name: "Other", document: { schemaVersion: 1 } });
    const ambiguous = await client.getPrompt({ name: "implement_design", arguments: {} });
    expect((ambiguous.messages[0]!.content as { text: string }).text).toContain(
      "implementing the project from",
    );

    const sync = await client.getPrompt({
      name: "sync_design_changes",
      arguments: { project: "team-tasks", since: "2" },
    });
    expect((sync.messages[0]!.content as { text: string }).text).toContain("`from: 2`");
    await client.close();
  });

  it("lists and reads resources", async () => {
    const { client } = await seed();
    const resources = await client.listResources();
    expect(resources.resources.map((r) => r.uri)).toEqual(
      expect.arrayContaining([
        "design://schema",
        "design://projects/team-tasks/brief",
        "design://projects/team-tasks/document",
      ]),
    );
    const brief = await client.readResource({ uri: "design://projects/team-tasks/brief" });
    const briefText = (brief.contents[0] as { text: string }).text;
    expect(briefText).toBe(raw(await call(client, "get_project_brief")));
    const doc = await client.readResource({ uri: "design://projects/team-tasks/document" });
    expect(JSON.parse((doc.contents[0] as { text: string }).text).schemaVersion).toBe(1);
    const schema = await client.readResource({ uri: "design://schema" });
    expect(JSON.parse((schema.contents[0] as { text: string }).text).type).toBe("object");
    await client.close();
  });
});
