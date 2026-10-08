import { describe, expect, it } from "vitest";

import { teamTasksDesign } from "@/lib/design/examples/team-tasks";
import { indexDesign } from "@/lib/design/graph";
import { parseDesign } from "@/lib/design/integrity";
import { toOpenApi } from "@/lib/design/openapi";

type Spec = {
  [key: string]: any; // eslint-disable-line @typescript-eslint/no-explicit-any
};
const index = () => indexDesign(parseDesign(teamTasksDesign));

describe("toOpenApi", () => {
  const spec = toOpenApi(index(), "api_rest") as Spec;

  it("matches the file snapshot", async () => {
    await expect(JSON.stringify(spec, null, 2) + "\n").toMatchFileSnapshot(
      "./__fixtures__/team-tasks.openapi.json",
    );
  });

  it("describes operations, parameters and entity refs", () => {
    expect(spec.openapi).toBe("3.1.0");
    expect(spec.info).toMatchObject({ title: "Tasks REST API", version: "1.0.0" });
    expect(spec.servers).toEqual([{ url: "/v1" }]);
    const operations = Object.values(spec.paths).flatMap((p) => Object.values(p as object));
    expect(operations).toHaveLength(3);
    expect(spec.paths["/projects/{projectId}/tasks"].get.parameters[0]).toMatchObject({
      name: "projectId",
      in: "path",
      required: true,
    });
    expect(
      spec.paths["/projects/{projectId}/tasks"].post.responses["200"].content["application/json"]
        .schema,
    ).toEqual({ $ref: "#/components/schemas/Task" });
    expect(spec.components.schemas.Task.required).toContain("title");
    expect(spec.components.schemas.Task.properties.status).toEqual({
      type: "string",
      enum: ["open", "done"],
      default: "open",
    });
    expect(spec.security).toEqual([{ bearerAuth: [] }]);
  });

  it("returns null for non-REST styles and non-apis", () => {
    const doc = parseDesign(teamTasksDesign);
    const api = doc.nodes.find((n) => n.id === "api_rest")!;
    if (api.kind === "api") api.data.style = "graphql";
    expect(toOpenApi(indexDesign(doc), "api_rest")).toBeNull();
    expect(toOpenApi(index(), "svc_api")).toBeNull();
  });

  it("marks auth: none operations as public and collects refs transitively", () => {
    const doc = parseDesign(teamTasksDesign);
    const api = doc.nodes.find((n) => n.id === "api_rest")!;
    if (api.kind === "api") api.data.operations[0]!.auth = "none";
    const task = doc.nodes.find((n) => n.id === "ent_task")!;
    if (task.kind === "entity") {
      task.data.fields.push({
        ...task.data.fields[0]!,
        name: "owner",
        type: "ref",
        refEntityId: "ent_user",
        primary: false,
      });
    }
    const out = toOpenApi(indexDesign(doc), "api_rest") as Spec;
    expect(out.paths["/projects/{projectId}/tasks"].get.security).toEqual([]);
    expect(Object.keys(out.components.schemas)).toEqual(["Task", "User"]);
  });
});
