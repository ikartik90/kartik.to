import type { BlockNode } from "@/domain/nodes";
import type { ReactNode } from "react";

/**
 * Maps every AST block node type to its React renderer function.
 * Both built-in typography nodes and custom embeddable component nodes
 * are registered here — there is no distinction at the rendering layer.
 *
 * When adding a new node type:
 *   1. Define its schema in src/domain/post.ts and add it to BlockNodeSchema.
 *   2. Add its renderer here, keyed by the same `type` string literal.
 */
export const nodeRenderers: {
  [K in BlockNode["type"]]?: (node: Extract<BlockNode, { type: K }>) => ReactNode;
} = {};
