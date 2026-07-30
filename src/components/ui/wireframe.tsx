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

// ---------------------------------------------------------------------------
// Wireframe — the skeleton treatment, applied by SCOPE rather than by prop.
//
//   <Wireframe>
//     <Combobox label="Shift role" hint="Pick one" />
//     <TextInput label="Break" />
//   </Wireframe>
//
// Everything inside renders as itself — real frame, real border, real checkbox
// box, real spacing — with only its TEXT swapped for a bar of the same line box
// (Figma 745:4375 light / 745:4080 dark). That fidelity is the whole point: the
// wireframe is the component, not a lookalike drawn beside it.
//
// It is a React context, not a descendant-selector stylesheet and not a prop on
// every component, for one reason: the substitution is per-part, and only the
// part knows what it is. A label becomes a bar; a checkbox box stays a box; a
// leading icon stays an icon; an <input> — which can hold no pseudo-element —
// has to be swapped for a span outright. No selector can make those calls, and
// a `wireframe` prop would have to be threaded through every compound part by
// hand. Text-bearing primitives call `useWireframe()` the way OptionList calls
// `useOptionalField()`, and everything else is untouched.
//
// There is deliberately no `<Wireframe.Reset>`: a live component simply sits
// outside the scope (in the Figma, the calendar is a SIBLING of the wireframed
// form, not a child of it). For the rare node that is structurally trapped
// inside one, a nested `<Wireframe enabled={false}>` is the escape hatch, and
// it falls out of the context for free.
//
// Two intents, one mechanism:
//   mode="placeholder" (default) — demo layouts that present a shape. Dimmed to
//     25%, decorative, hidden from assistive tech.
//   mode="loading" — real content pending. Full strength, shimmering, announced
//     as `aria-busy` so it is heard rather than hidden.
// ---------------------------------------------------------------------------

export type WireframeMode = "placeholder" | "loading";

/**
 * How far a wireframe recedes, as a PERCENTAGE — 25 is barely-there background
 * furniture, 100 is undimmed. Four deliberate depths rather than a free number,
 * so blocks across a page land on the same few planes instead of drifting.
 */
export type WireframeOpacity = 25 | 50 | 75 | 100;

export interface WireframeContextValue {
  /** What the scope is standing in for — see the mode notes above. */
  mode: WireframeMode;
}

const WireframeContext = createContext<WireframeContextValue | null>(null);

/**
 * Read the enclosing wireframe scope, or `null` outside one — the same
 * optional-context shape as `useOptionalField`, and for the same reason: a
 * primitive that consumes this must still render normally on its own. Callers
 * treat a non-null return as "render my text as a bar".
 */
export function useWireframe(): WireframeContextValue | null {
  return useContext(WireframeContext);
}

// --- The bar ---------------------------------------------------------------

export interface SkeletonProps
  extends Omit<HTMLAttributes<HTMLSpanElement>, "children"> {
  /**
   * The text this bar replaces. It stays in the DOM (hidden with `visibility`,
   * so it measures but neither paints nor reaches a screen reader) purely so the
   * bar inherits its natural width — the thing that keeps a wireframed field the
   * same size as the live one.
   */
  children?: ReactNode;
  /** Explicit bar width, for a bar standing in for text that does not exist yet. */
  width?: string;
  /** Stack this many bars — copy whose shape is known but whose text is not. */
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
      {/* A non-breaking space when there is nothing to measure, so the bar still
          gets a line box to sit in rather than collapsing to nothing. */}
      <span className={styles.text}>{children ?? " "}</span>
    </span>
  );
}

/**
 * A single skeleton bar occupying the line box of the text it stands for.
 * Usually rendered for you by a primitive inside a {@link Wireframe}; reach for
 * it directly when hand-building a loading placeholder.
 *
 * @example
 * <Skeleton>Shift role</Skeleton>   // bar the width of that string
 * <Skeleton width="12ch" />         // bar of a stated width
 * <Skeleton lines={3} />            // a paragraph's worth, last line ragged
 */
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

/**
 * The one-liner a text-bearing primitive wraps its children in: one bar across
 * the whole run inside a wireframe scope, the children untouched outside one.
 * For parts whose children ARE the text — a label, a hint, a paragraph — where
 * inline emphasis should still read as a single continuous bar.
 */
export function WireframeText({
  children,
  width,
}: {
  children?: ReactNode;
  width?: string;
}) {
  const active = useWireframe() !== null;
  // An author who wrote the bar themselves has already said what the shape is —
  // the loading case, where there is no text to measure. Wrapping it again would
  // bury their bar inside an outer one that `visibility: hidden` then hides.
  if (!active || authoredSkeleton(children)) return <>{children}</>;
  return <Skeleton width={width}>{children}</Skeleton>;
}

/** True when the caller has supplied a `Skeleton` among these children. */
function authoredSkeleton(children: ReactNode): boolean {
  return Children.toArray(children).some(
    (child) => isValidElement(child) && child.type === Skeleton,
  );
}

/**
 * The mixed-content counterpart: bars the text runs and leaves everything else
 * standing. For parts whose children pair a label with an icon — a menu option,
 * a text button — where wrapping the lot would swallow the glyph into the bar.
 * Elements pass through untouched, so a nested `Button.Text` still wireframes
 * itself through {@link WireframeText} rather than being double-wrapped.
 */
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

// --- The scope -------------------------------------------------------------

export interface WireframeProps extends HTMLAttributes<HTMLDivElement> {
  /**
   * Off → children render live. Lets a loading region flip without branching its
   * JSX (`<Wireframe enabled={isPending}>`), and doubles as the opt-out for a
   * subtree nested inside another scope. The scope's box is the same either way,
   * so flipping it never shifts the surrounding layout.
   */
  enabled?: boolean;
  /** `placeholder` (static demo furniture) or `loading` (shimmering, pending). */
  mode?: WireframeMode;
  /**
   * How far the block recedes, as a percentage: `25`, `50`, `75` or `100`.
   * Independent of `mode` and of `interactive`, so an interactive wireframe or a
   * shimmering loading one can sit at any depth. Defaults to `50`.
   */
  opacity?: WireframeOpacity;
  /**
   * Keep the subtree live — the combobox still opens, the checkbox still
   * toggles, only the text reads as bars. Off (the default) the scope is `inert`,
   * which unlike `pointer-events: none` also takes it out of the tab order.
   */
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
  // The recipe keys its variants by string (Panda stringifies object keys), while
  // the prop is a number so it reads as the percentage it is.
  const level = String(opacity) as `${WireframeOpacity}`;

  return (
    <WireframeContext.Provider value={value}>
      <div
        className={
          enabled ? cx(wireframe({ mode, opacity: level }), className) : className
        }
        // `inert` is what actually makes a non-interactive block non-interactive:
        // no focus, no clicks, out of the accessibility tree.
        inert={enabled && !interactive}
        // A placeholder is decorative furniture, so it is hidden outright — but
        // only while it is also inert, since hiding a subtree that still holds
        // focusable controls is worse than not hiding it at all.
        aria-hidden={
          enabled && !interactive && mode === "placeholder" ? true : undefined
        }
        // A loading scope is the opposite: it stays in the tree and announces
        // that its content is on the way.
        aria-busy={enabled && mode === "loading" ? true : undefined}
        {...rest}
      >
        {children}
      </div>
    </WireframeContext.Provider>
  );
}
