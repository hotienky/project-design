import type { NodeTypes } from "@xyflow/react";

import {
  CardNode,
  ContainerNode,
  EntityNode,
  NoteNode,
  SummaryNode,
} from "@/components/designer/nodes/base-node";
import {
  ApiOperationsNode,
  LayerBandNode,
  PerspectiveCardNode,
  ServiceFrameNode,
} from "@/components/designer/nodes/perspective-nodes";

/**
 * React Flow node types, keyed by design node kind, plus "summary" for the levels view's
 * collapsed containers and context nodes, plus the API / Layers perspectives' own node types.
 * Defined once (a stable reference).
 */
export const nodeTypes = {
  service: ContainerNode,
  layer: ContainerNode,
  datastore: ContainerNode,
  system: ContainerNode,
  loop: CardNode,
  mechanic: CardNode,
  resource: CardNode,
  content: CardNode,
  module: CardNode,
  api: CardNode,
  integration: CardNode,
  queue: CardNode,
  actor: CardNode,
  entity: EntityNode,
  note: NoteNode,
  summary: SummaryNode,
  perspectiveCard: PerspectiveCardNode,
  apiOperations: ApiOperationsNode,
  serviceFrame: ServiceFrameNode,
  layerBand: LayerBandNode,
} satisfies NodeTypes;
