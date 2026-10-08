import type { EdgeKind, NodeKind } from "@/lib/design/schema";

const ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

/** Short random id body (lowercase base36). 10 chars = ~51 bits; plenty per project. */
export function randomIdBody(length = 10): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  let out = "";
  for (const b of bytes) out += ALPHABET[b % ALPHABET.length];
  return out;
}

export const NODE_ID_PREFIX: Record<NodeKind, string> = {
  service: "svc",
  layer: "lyr",
  module: "mod",
  entity: "ent",
  datastore: "dst",
  api: "api",
  integration: "int",
  queue: "que",
  actor: "act",
  note: "nte",
};

export const newNodeId = (kind: NodeKind) => `${NODE_ID_PREFIX[kind]}_${randomIdBody()}`;
export const newEdgeId = (_kind?: EdgeKind) => `e_${randomIdBody()}`;
/** Ids for list items inside a document: stack items, conventions, decisions, operations… */
export const newItemId = (prefix: "stk" | "cnv" | "adr" | "op" | "ch") =>
  `${prefix}_${randomIdBody(8)}`;
