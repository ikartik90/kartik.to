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
  type TextareaHTMLAttributes,
  type ReactNode,
} from "react";
import { css, cx } from "../../../../styled-system/css";
import { field } from "../../../../styled-system/recipes";
import { Skeleton, WireframeText, useWireframe } from "../wireframe";

type FieldSize = "sm" | "md" | "lg";
type FieldStyles = ReturnType<typeof field>;

/** The text styles a part's `type` override may pick from. */
export type FieldTextStyle =
  | "fineprint"
  | "caption"
  | "sidenote"
  | "bodySmall"
  | "bodyLarge"
  | "subheading";

// Literal css() calls: a dynamic `css({ textStyle })` is invisible to Panda's extractor.
const TEXT_STYLE_OVERRIDE: Record<FieldTextStyle, string> = {
  fineprint: css({ textStyle: "fineprint" }),
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
  styles: FieldStyles;
};

const FieldContext = createContext<FieldContextValue | null>(null);

export function useField(component: string): FieldContextValue {
  const ctx = useContext(FieldContext);
  if (!ctx) throw new Error(`${component} must be used within <Field>.`);
  return ctx;
}

/** {@link useField} that returns null outside a <Field> instead of throwing. */
export function useOptionalField(): FieldContextValue | null {
  return useContext(FieldContext);
}

export interface FieldProps extends HTMLAttributes<HTMLDivElement> {
  size?: FieldSize;
  /** Toggle controls only: the label leads and the control sits on the far edge. */
  labelFirst?: boolean;
  children: ReactNode;
}

function FieldRoot({
  children,
  className,
  size = "md",
  labelFirst = false,
  ...rest
}: FieldProps) {
  const uid = useId();
  const controlRef = useRef<HTMLElement | null>(null);
  const [hasLabel, setHasLabel] = useState(false);
  const [hasHint, setHasHint] = useState(false);
  const styles = field({ size, labelFirst });

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
  /** Overrides this label's size-derived text style. */
  type?: FieldTextStyle;
  children: ReactNode;
}

function FieldLabel({ children, type, className, ...rest }: FieldLabelProps) {
  const { controlId, labelId, setHasLabel, styles } = useField("Field.Label");
  // Registered so a group control (Calendar) can point aria-labelledby at it.
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
      <WireframeText>{children}</WireframeText>
    </label>
  );
}

export interface FieldFrameProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

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
        if (
          (e.target as HTMLElement).closest(
            "input, textarea, select, button, a, [data-control]",
          )
        ) {
          return;
        }
        e.preventDefault();
        focusControl();
      }}
      {...rest}
    >
      {children}
    </div>
  );
}


export type FieldControlProps = InputHTMLAttributes<HTMLInputElement>;

const FieldControl = forwardRef<HTMLInputElement, FieldControlProps>(
  function FieldControl({ className, ...rest }, forwardedRef) {
    const { controlId, hintId, hasHint, registerControl, styles } =
      useField("Field.Control");
    const isWireframe = useWireframe() !== null;

    // An <input> can hold no bar, so wireframe mode swaps in a static slot without `data-control`.
    if (isWireframe) {
      const stand = rest.placeholder ?? rest.value ?? rest.defaultValue;
      const text = typeof stand === "string" && stand !== "" ? stand : undefined;
      return (
        <span id={controlId} className={cx(styles.control, className)}>
          <Skeleton width={text ? undefined : "45%"}>{text}</Skeleton>
        </span>
      );
    }

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

export type FieldTextAreaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

/** `resize` is off in the recipe: the frame clips, so size the box with `rows`. */
const FieldTextArea = forwardRef<HTMLTextAreaElement, FieldTextAreaProps>(
  function FieldTextArea({ className, ...rest }, forwardedRef) {
    const { controlId, hintId, hasHint, registerControl, styles } =
      useField("Field.TextArea");
    const isWireframe = useWireframe() !== null;

    if (isWireframe) {
      const stand = rest.placeholder ?? rest.value ?? rest.defaultValue;
      const text = typeof stand === "string" && stand !== "" ? stand : undefined;
      return (
        <span id={controlId} className={cx(styles.control, className)}>
          <Skeleton width={text ? undefined : "45%"}>{text}</Skeleton>
        </span>
      );
    }

    return (
      <textarea
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
  /** Overrides this hint's size-derived text style. */
  type?: FieldTextStyle;
  children: ReactNode;
}

function FieldHint({ children, type, className, ...rest }: FieldHintProps) {
  const { hintId, setHasHint, styles } = useField("Field.Hint");
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
      <WireframeText>{children}</WireframeText>
    </p>
  );
}

export interface FieldSearchProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
}

// Deliberately dumb: emits the raw query; the container (Calendar, OptionList) interprets it.
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

export const Field = Object.assign(FieldRoot, {
  Label: FieldLabel,
  Frame: FieldFrame,
  Control: FieldControl,
  TextArea: FieldTextArea,
  Hint: FieldHint,
  Search: FieldSearch,
});
