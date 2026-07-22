"use client";

import {
  createContext,
  forwardRef,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type LabelHTMLAttributes,
  type ReactNode,
} from "react";
import { css, cx } from "../../../../styled-system/css";
import { field } from "../../../../styled-system/recipes";

type FieldSize = "sm" | "md" | "lg";
type FieldStyles = ReturnType<typeof field>;

/**
 * The field text scale — the guardrailed set a part's `type` override may pick
 * from (a curated subset of the typography tokens; `title`/`quote`/`code` are
 * article styles and deliberately excluded). Set `type` to deviate a single
 * part from the field's size-derived default; reach for `className` only to go
 * outside the scale.
 */
export type FieldTextStyle =
  | "caption"
  | "sidenote"
  | "bodySmall"
  | "bodyLarge"
  | "subheading";

// Pre-generated from literal css() calls: a dynamic `css({ textStyle: type })`
// is invisible to Panda's static extractor and would emit no CSS, so each
// override utility is spelled out here (mirrors the recipe's staticCss trick).
const TEXT_STYLE_OVERRIDE: Record<FieldTextStyle, string> = {
  caption: css({ textStyle: "caption" }),
  sidenote: css({ textStyle: "sidenote" }),
  bodySmall: css({ textStyle: "bodySmall" }),
  bodyLarge: css({ textStyle: "bodyLarge" }),
  subheading: css({ textStyle: "subheading" }),
};

type FieldContextValue = {
  controlId: string;
  hintId: string;
  size: FieldSize;
  hasHint: boolean;
  setHasHint: (present: boolean) => void;
  registerControl: (node: HTMLElement | null) => void;
  focusControl: () => void;
  // Slot classNames resolved once in the root (they depend on `size`) and shared
  // with every part, so a Field.Label / Switch in another file styles itself
  // from the same source without re-invoking the recipe.
  styles: FieldStyles;
};

const FieldContext = createContext<FieldContextValue | null>(null);

/** Read the enclosing field's context; throws if a part is used outside <Field>. */
export function useField(component: string): FieldContextValue {
  const ctx = useContext(FieldContext);
  if (!ctx) throw new Error(`${component} must be used within <Field>.`);
  return ctx;
}

export interface FieldProps extends HTMLAttributes<HTMLDivElement> {
  /**
   * Scales the field as a set — label/hint typography (and, for text inputs, the
   * frame; for switches, the track geometry via the control). `md` is the text
   * default; switches use `sm` or `lg`.
   */
  size?: FieldSize;
  children: ReactNode;
}

/**
 * The field root — pure layout plus the context that wires the compound parts
 * together: it mints the control/hint ids (so Label ↔ Control and the
 * aria-describedby link resolve automatically), resolves the size-dependent slot
 * styles once, and holds the control ref used to forward focus from the frame's
 * dead space. The layout adapts to its control: a `role="switch"` inside flips
 * the root from a vertical stack to the control ∣ label/hint grid (see the
 * `field` recipe's `:has` branches), so no orientation prop is needed.
 */
function FieldRoot({ children, className, size = "md", ...rest }: FieldProps) {
  const uid = useId();
  const controlRef = useRef<HTMLElement | null>(null);
  const [hasHint, setHasHint] = useState(false);
  const styles = field({ size });

  const ctx: FieldContextValue = {
    controlId: `${uid}-control`,
    hintId: `${uid}-hint`,
    size,
    hasHint,
    setHasHint,
    registerControl: (node) => {
      controlRef.current = node;
    },
    focusControl: () => controlRef.current?.focus(),
    styles,
  };

  return (
    <FieldContext.Provider value={ctx}>
      <div data-field className={cx(styles.root, className)} {...rest}>
        {children}
      </div>
    </FieldContext.Provider>
  );
}

export interface FieldLabelProps extends LabelHTMLAttributes<HTMLLabelElement> {
  /**
   * Override this label's typography, independent of the field `size`. Unset →
   * inherits the field's size-derived default; set → deviates just this label,
   * bounded to {@link FieldTextStyle}. The override lands in the utilities layer,
   * so it wins over the recipe cleanly.
   */
  type?: FieldTextStyle;
  children: ReactNode;
}

function FieldLabel({ children, type, className, ...rest }: FieldLabelProps) {
  const { controlId, styles } = useField("Field.Label");
  return (
    <label
      htmlFor={controlId}
      className={cx(styles.label, type && TEXT_STYLE_OVERRIDE[type], className)}
      {...rest}
    >
      {children}
    </label>
  );
}

export interface FieldFrameProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

/**
 * The presentational input shell — border, fill, and the leading/control/
 * trailing layout. It owns no value or keyboard behavior; its one job beyond
 * looks is to forward a click on its dead padding to the control so the field
 * doesn't feel broken near the edges.
 */
function FieldFrame({
  children,
  className,
  onMouseDown,
  ...rest
}: FieldFrameProps) {
  const { focusControl, styles } = useField("Field.Frame");
  return (
    <div
      className={cx(styles.frame, className)}
      onMouseDown={(e) => {
        onMouseDown?.(e);
        if (e.defaultPrevented) return;
        // Interactive descendants (the control, or a future trailing action
        // button) handle their own focus — only the frame's padding and the
        // decorative leading icon forward focus to the control.
        if (
          (e.target as HTMLElement).closest(
            "input, textarea, select, button, a, [data-control]",
          )
        ) {
          return;
        }
        e.preventDefault(); // keep selection; focus lands without a blur flash
        focusControl();
      }}
      {...rest}
    >
      {children}
    </div>
  );
}

export interface FieldAdornmentProps extends HTMLAttributes<HTMLSpanElement> {
  children: ReactNode;
}

/** Decorative leading slot — hidden from assistive tech, non-interactive. */
function FieldAdornment({ children, className, ...rest }: FieldAdornmentProps) {
  const { styles } = useField("Field.Adornment");
  return (
    <span aria-hidden className={cx(styles.leading, className)} {...rest}>
      {children}
    </span>
  );
}

export type FieldControlProps = InputHTMLAttributes<HTMLInputElement>;

/** The value slot for a text field — a native input carrying `data-control`. */
const FieldControl = forwardRef<HTMLInputElement, FieldControlProps>(
  function FieldControl({ className, ...rest }, forwardedRef) {
    const { controlId, hintId, hasHint, registerControl, styles } =
      useField("Field.Control");
    return (
      <input
        ref={(node) => {
          registerControl(node);
          if (typeof forwardedRef === "function") forwardedRef(node);
          else if (forwardedRef) forwardedRef.current = node;
        }}
        id={controlId}
        data-control
        aria-describedby={hasHint ? hintId : undefined}
        className={cx(styles.control, className)}
        {...rest}
      />
    );
  },
);

export interface FieldHintProps extends HTMLAttributes<HTMLParagraphElement> {
  /**
   * Override this hint's typography, independent of the field `size` (see
   * {@link FieldLabelProps.type}).
   */
  type?: FieldTextStyle;
  children: ReactNode;
}

function FieldHint({ children, type, className, ...rest }: FieldHintProps) {
  const { hintId, setHasHint, styles } = useField("Field.Hint");
  // Register presence so the control only advertises aria-describedby when a
  // hint is actually mounted (no dangling id reference otherwise).
  useEffect(() => {
    setHasHint(true);
    return () => setHasHint(false);
  }, [setHasHint]);
  return (
    <p
      id={hintId}
      className={cx(styles.hint, type && TEXT_STYLE_OVERRIDE[type], className)}
      {...rest}
    >
      {children}
    </p>
  );
}

/**
 * Compound field primitives. Presentation (root/label/frame/adornment/hint) is
 * shared and dumb; behavior lives in the control slot, which the assemblies
 * (TextInput, and later Select/Date) fill. The Switch plugs into the same
 * context as an alternative control (see switch.tsx), reusing Label + Hint.
 * Compose these directly for bespoke fields, or use the flat-prop assemblies for
 * the common case.
 */
export const Field = Object.assign(FieldRoot, {
  Label: FieldLabel,
  Frame: FieldFrame,
  Adornment: FieldAdornment,
  Control: FieldControl,
  Hint: FieldHint,
});
