"use client";

import {
  Children,
  createContext,
  isValidElement,
  useContext,
  useMemo,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import { cx } from "../../../styled-system/css";
import { skeleton, wireframe } from "../../../styled-system/recipes";

// Inside a scope, text-bearing primitives (via `useWireframe()`) swap their text for a bar of the
// same line box; everything else renders as itself.

export type WireframeMode = "placeholder" | "loading";

export type WireframeOpacity = 25 | 50 | 75 | 100;

export interface WireframeContextValue {
  mode: WireframeMode;
}

const WireframeContext = createContext<WireframeContextValue | null>(null);

/** The enclosing scope, or `null` outside one; non-null means render text as a bar. */
export function useWireframe(): WireframeContextValue | null {
  return useContext(WireframeContext);
}

export interface SkeletonProps
  extends Omit<HTMLAttributes<HTMLSpanElement>, "children"> {
  /** The replaced text, kept (hidden) so the bar takes its width. */
  children?: ReactNode;
  width?: string;
  lines?: number;
}

function SkeletonBar({
  children,
  width,
  className,
  style,
  ...rest
}: SkeletonProps) {
  const styles = skeleton();
  return (
    <span
      data-skeleton
      className={cx(styles.root, className)}
      style={{ width, ...style }}
      {...rest}
    >
      {/* A non-breaking space, so an empty bar still gets a line box. */}
      <span className={styles.text}>{children ?? " "}</span>
    </span>
  );
}

export function Skeleton({ lines, ...rest }: SkeletonProps) {
  const styles = skeleton();
  if (lines == null) return <SkeletonBar {...rest} />;

  const { className, style, width: _width, children: _children, ...spanRest } = rest;
  return (
    <span className={cx(styles.lines, className)} style={style} {...spanRest}>
      {Array.from({ length: lines }, (_, i) => (
        <SkeletonBar key={i} />
      ))}
    </span>
  );
}

/** One bar across the whole run inside a scope; children untouched outside one. */
export function WireframeText({
  children,
  width,
}: {
  children?: ReactNode;
  width?: string;
}) {
  const active = useWireframe() !== null;
  // A caller-supplied Skeleton isn't wrapped again: the outer bar would hide it.
  if (!active || authoredSkeleton(children)) return <>{children}</>;
  return <Skeleton width={width}>{children}</Skeleton>;
}

function authoredSkeleton(children: ReactNode): boolean {
  return Children.toArray(children).some(
    (child) => isValidElement(child) && child.type === Skeleton,
  );
}

/** Bars only the string children, leaving icons and elements standing. */
export function WireframeContent({ children }: { children?: ReactNode }) {
  const active = useWireframe() !== null;
  if (!active) return <>{children}</>;
  return (
    <>
      {Children.map(children, (child) =>
        typeof child === "string" || typeof child === "number" ? (
          <Skeleton>{child}</Skeleton>
        ) : (
          child
        ),
      )}
    </>
  );
}

export interface WireframeProps extends HTMLAttributes<HTMLDivElement> {
  /** Off renders the children live; also the opt-out inside another scope. */
  enabled?: boolean;
  mode?: WireframeMode;
  opacity?: WireframeOpacity;
  /** Keeps the subtree live; otherwise the scope is `inert`. */
  interactive?: boolean;
  children: ReactNode;
}

export function Wireframe({
  enabled = true,
  mode = "placeholder",
  opacity = 50,
  interactive = false,
  children,
  className,
  ...rest
}: WireframeProps) {
  const value = useMemo(() => (enabled ? { mode } : null), [enabled, mode]);
  // Panda keys variants by string.
  const level = String(opacity) as `${WireframeOpacity}`;

  return (
    <WireframeContext.Provider value={value}>
      <div
        className={
          enabled ? cx(wireframe({ mode, opacity: level }), className) : className
        }
        inert={enabled && !interactive}
        // Hidden only while inert: hiding focusable controls is worse than not hiding.
        aria-hidden={
          enabled && !interactive && mode === "placeholder" ? true : undefined
        }
        aria-busy={enabled && mode === "loading" ? true : undefined}
        {...rest}
      >
        {children}
      </div>
    </WireframeContext.Provider>
  );
}
