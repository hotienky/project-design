import type { NodeTypes } from "@xyflow/react";

import {
  CardNode,
  ContainerNode,
  EntityNode,
  NoteNode,
  SummaryNode,
} from "@/components/designer/nodes/base-node";

/**
 * React Flow node types, keyed by design node kind, plus "summary" for the levels view's
 * collapsed containers and context nodes. Defined once (a stable reference).
 */
export const nodeTypes = {
  service: ContainerNode,
  layer: ContainerNode,
  datastore: ContainerNode,
  module: CardNode,
  api: CardNode,
  integration: CardNode,
  queue: CardNode,
  actor: CardNode,
  entity: EntityNode,
  note: NoteNode,
  summary: SummaryNode,
} satisfies NodeTypes;
