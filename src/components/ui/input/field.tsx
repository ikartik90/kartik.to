"use client";

import {
  createContext,
  forwardRef,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
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
  labelId: string;
  hintId: string;
  size: FieldSize;
  hasLabel: boolean;
  setHasLabel: (present: boolean) => void;
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

/**
 * Like {@link useField} but returns null outside a <Field> instead of throwing.
 * For a control that composes INTO a Field when there's a label/hint to wire
 * (the Combobox's OptionList), yet also stands alone with nothing to label (a
 * toolbar, the slash menu). OptionList reads the field ONLY for the aria-*
 * wiring, so when there's no Field it simply emits no aria-labelledby/-describedby
 * — exactly right for a control that isn't a labelled form field.
 */
export function useOptionalField(): FieldContextValue | null {
  return useContext(FieldContext);
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
  const [hasLabel, setHasLabel] = useState(false);
  const [hasHint, setHasHint] = useState(false);
  const styles = field({ size });

  const ctx: FieldContextValue = {
    controlId: `${uid}-control`,
    labelId: `${uid}-label`,
    hintId: `${uid}-hint`,
    size,
    hasLabel,
    setHasLabel,
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
  const { controlId, labelId, setHasLabel, styles } = useField("Field.Label");
  // Register presence + expose an id so a compound control that can't be a
  // single `htmlFor` target (e.g. the Calendar group) can `aria-labelledby` it.
  useEffect(() => {
    setHasLabel(true);
    return () => setHasLabel(false);
  }, [setHasLabel]);
  return (
    <label
      id={labelId}
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

export type FieldActionProps = ButtonHTMLAttributes<HTMLButtonElement>;

// Interactive trailing/utility button — the counterpart to the decorative
// Adornment. Being a real <button> it keeps its own focus and is excluded from
// the frame's focus-forwarding (see FieldFrame's `closest(...button...)`), so it
// never steals a padding-click meant for the control. Reused for the calendar's
// month chevrons (Calendar.Period) and future clear/reveal toggles.
const fieldActionClass = css({
  display: "grid",
  placeItems: "center",
  flexShrink: 0,
  // Sized to the calendar's column pitch so the chevrons sit on the same grid
  // as the day cells (Figma 563:2714/563:2718 — a 24px hit target, 20px glyph).
  width: "token(sizes.calendarDay)",
  height: "token(sizes.calendarDay)",
  borderRadius: "sm",
  border: "none",
  background: "transparent",
  appearance: "none",
  color: "inherit",
  cursor: "pointer",
  transition: "background-color 150ms ease, color 150ms ease",
  "&:hover": { backgroundColor: "bg.itemHover" },
  "&:disabled": {
    opacity: 0.4,
    cursor: "not-allowed",
    "&:hover": { backgroundColor: "transparent" },
  },
  "& svg": {
    width: "token(spacing.xxl)",
    height: "token(spacing.xxl)",
    display: "block",
  },
  "& svg path[stroke]": { stroke: "currentColor" },
  "& svg path[fill]": { fill: "currentColor" },
});

const FieldAction = forwardRef<HTMLButtonElement, FieldActionProps>(
  function FieldAction({ className, type, ...rest }, ref) {
    return (
      <button
        ref={ref}
        type={type ?? "button"}
        className={cx(fieldActionClass, className)}
        {...rest}
      />
    );
  },
);

export interface FieldSearchProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> {
  /** Controlled query. */
  value?: string;
  /** Initial query when uncontrolled. */
  defaultValue?: string;
  /** Fired with the raw query string on every keystroke. */
  onValueChange?: (value: string) => void;
}

// A bare, borderless search input — the type-ahead slot atop the calendar /
// option-list popover, reusable by any filterable control. Presentation-light so
// a parent slot (the recipe's `search`) can dress it via `className`; owns only
// the controlled/uncontrolled value like Switch. Deliberately DUMB: it emits
// nothing but the raw query string. Interpreting that query — parsing a date,
// filtering a list, ranking matches — belongs to the container it's dropped into
// (Calendar's `queryParser`, OptionList's `filter`), the only node that holds
// what the query is matched against. That's what lets the SAME box serve the
// date field and the option list untouched.
const FieldSearch = forwardRef<HTMLInputElement, FieldSearchProps>(
  function FieldSearch(
    { className, value, defaultValue, onValueChange, onInput, ...rest },
    ref,
  ) {
    return (
      <input
        ref={ref}
        type="search"
        value={value}
        defaultValue={defaultValue}
        className={className}
        onInput={(e) => {
          onInput?.(e);
          onValueChange?.(e.currentTarget.value);
        }}
        {...rest}
      />
    );
  },
);

/**
 * Compound field primitives. Presentation (root/label/frame/hint) is shared and
 * dumb; behavior lives in the control slot, which the assemblies (TextInput, and
 * later Select/Date) fill. Decorative icons compose straight into the Frame as
 * bare `<Icon aria-hidden />` children — the `frame` recipe sizes and tints them
 * (leading before the control, trailing after it); no wrapper part. The Switch
 * plugs into the same context as an alternative control (see switch.tsx), reusing
 * Label + Hint; Action (interactive button) and Search (type-ahead input) are the
 * shared pieces the Calendar composes. Compose these directly for bespoke fields,
 * or use the flat-prop assemblies for the common case.
 */
export const Field = Object.assign(FieldRoot, {
  Label: FieldLabel,
  Frame: FieldFrame,
  Control: FieldControl,
  Hint: FieldHint,
  Action: FieldAction,
  Search: FieldSearch,
});
