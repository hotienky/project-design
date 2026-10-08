/** OpenAPI 3.1 rendering of a REST api node. */
import type { DesignIndex } from "@/lib/design/graph";
import type { Field, NodeOfKind, Operation, TypeShape } from "@/lib/design/schema";

type Json = Record<string, unknown>;

const FORMATS: Partial<Record<Field["type"], Json>> = {
  decimal: { type: "string", format: "decimal" },
  date: { type: "string", format: "date" },
  datetime: { type: "string", format: "date-time" },
  uuid: { type: "string", format: "uuid" },
  email: { type: "string", format: "email" },
  url: { type: "string", format: "uri" },
};

export function toOpenApi(index: DesignIndex, apiId: string): Json | null {
  const api = index.node(apiId);
  if (api?.kind !== "api" || api.data.style !== "rest") return null;

  const schemaNames = new Map<string, string>(); // entity id → components.schemas key
  const queue: string[] = [];
  const used = new Set<string>();
  const refEntity = (entityId: string): Json => {
    let name = schemaNames.get(entityId);
    if (!name) {
      const entity = index.node(entityId);
      const base = (entity?.name ?? entityId).replace(/[^A-Za-z0-9_]/g, "") || "Schema";
      name = base;
      for (let n = 2; used.has(name); n++) name = `${base}${n}`;
      used.add(name);
      schemaNames.set(entityId, name);
      queue.push(entityId);
    }
    return { $ref: `#/components/schemas/${name}` };
  };

  const fieldSchema = (f: Field): Json => {
    let schema: Json;
    switch (f.type) {
      case "string":
      case "text":
        schema = { type: "string" };
        break;
      case "int":
        schema = { type: "integer" };
        break;
      case "float":
        schema = { type: "number" };
        break;
      case "boolean":
        schema = { type: "boolean" };
        break;
      case "json":
        schema = {};
        break;
      case "enum":
        schema = { type: "string", enum: f.enumValues };
        break;
      case "ref":
        schema = f.refEntityId ? refEntity(f.refEntityId) : {};
        break;
      default:
        schema = { ...FORMATS[f.type] };
    }
    if (f.type !== "ref" && f.default !== null) {
      if (f.type === "int" || f.type === "float") {
        const n = Number(f.default);
        schema.default = Number.isFinite(n) ? n : f.default;
      } else if (f.type === "boolean") {
        schema.default = f.default === "true" ? true : f.default === "false" ? false : f.default;
      } else schema.default = f.default;
    }
    if (f.description) schema.description = f.description;
    return f.list ? { type: "array", items: schema } : schema;
  };

  const objectSchema = (fields: Field[], description = ""): Json => {
    const required = fields.filter((f) => f.required).map((f) => f.name);
    return {
      type: "object",
      ...(description ? { description } : {}),
      properties: Object.fromEntries(fields.map((f) => [f.name, fieldSchema(f)])),
      ...(required.length > 0 ? { required } : {}),
    };
  };

  const shapeSchema = (shape: TypeShape): Json => {
    if (shape.entityId) {
      const ref = refEntity(shape.entityId);
      return shape.list ? { type: "array", items: ref } : ref;
    }
    const object = objectSchema(shape.fields, shape.description);
    return shape.list ? { type: "array", items: object } : object;
  };

  const paths: Record<string, Record<string, Json>> = {};
  for (const op of api.data.operations) {
    if (!op.method || !op.path) continue;
    (paths[op.path] ??= {})[op.method.toLowerCase()] = operationObject(op, api, shapeSchema);
  }

  // Entities referenced anywhere (transitively through ref fields) become components.
  const schemas: Record<string, Json> = {};
  for (let i = 0; i < queue.length; i++) {
    const id = queue[i]!;
    const entity = index.node(id);
    schemas[schemaNames.get(id)!] =
      entity?.kind === "entity"
        ? objectSchema(entity.data.fields, entity.description)
        : { type: "object" };
  }

  const scheme = securityScheme(api.data.auth);
  return {
    openapi: "3.1.0",
    info: {
      title: api.name,
      version: api.data.version || "0.0.0",
      ...(api.description ? { description: api.description } : {}),
    },
    servers: [{ url: api.data.basePath || "/" }],
    ...(scheme ? { security: [{ [scheme.name]: [] }] } : {}),
    paths,
    components: {
      schemas: Object.fromEntries(Object.entries(schemas).sort(([a], [b]) => a.localeCompare(b))),
      ...(scheme ? { securitySchemes: { [scheme.name]: scheme.definition } } : {}),
    },
  };
}

function securityScheme(auth: NodeOfKind<"api">["data"]["auth"]) {
  switch (auth) {
    case "bearer":
    case "oauth2":
      return { name: "bearerAuth", definition: { type: "http", scheme: "bearer" } };
    case "api-key":
      return {
        name: "apiKeyAuth",
        definition: { type: "apiKey", in: "header", name: "X-API-Key" },
      };
    case "session":
      return {
        name: "sessionAuth",
        definition: { type: "apiKey", in: "cookie", name: "session" },
      };
    default:
      return null;
  }
}

function operationObject(
  op: Operation,
  api: NodeOfKind<"api">,
  shapeSchema: (shape: TypeShape) => Json,
): Json {
  const parameters = [...op.path!.matchAll(/\{([^}]+)\}/g)].map((m) => ({
    name: m[1],
    in: "path",
    required: true,
    schema: { type: "string" },
  }));
  const responses: Record<string, Json> = op.response
    ? {
        "200": {
          description: op.summary || "Success",
          content: { "application/json": { schema: shapeSchema(op.response) } },
        },
      }
    : { "204": { description: "No content" } };
  for (const err of op.errors)
    responses[String(err.status)] = { description: err.description || "Error" };

  return {
    operationId: op.name,
    ...(op.summary ? { summary: op.summary } : {}),
    parameters,
    ...(op.request
      ? {
          requestBody: {
            required: true,
            content: { "application/json": { schema: shapeSchema(op.request) } },
          },
        }
      : {}),
    responses,
    ...(op.auth === "none" && api.data.auth !== "none" ? { security: [] } : {}),
  };
}
