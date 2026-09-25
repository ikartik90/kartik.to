import type { BlockNode } from "@/domain/nodes";
import type { ReactNode } from "react";

/** Renderer per block node type; a new node type needs its schema in BlockNodeSchema and a renderer here. */
export const nodeRenderers: {
  [K in BlockNode["type"]]?: (node: Extract<BlockNode, { type: K }>) => ReactNode;
} = {};
