"use client";

import { createContext, use, useId, useState, type ReactNode } from "react";
import { css } from "../../../../styled-system/css";
import { ownPart, partsOf, useOwner } from "./slots";
import { Field, FieldContext, Typography, boxRaw, fieldState, smallButtonStyle, useField } from "./ui";
import ShowIcon from "./assets/icons/medium/show.svg";
import HideIcon from "./assets/icons/medium/hide.svg";
import EmptyIcon from "./assets/icons/small/empty.svg";
import SuccessIcon from "./assets/icons/small/success.svg";
import AlertIcon from "./assets/icons/small/alert.svg";

// SW Curie's password, verification code and file upload, from the Form page (392:354).

export type ConditionState = "default" | "condition met" | "condition unmet";

/** What each of a password's conditions asks of it. */
const RULES = {
  length: /[\s\S]{8}/u,
  uppercase: /\p{Lu}/u,
  lowercase: /\p{Ll}/u,
  number: /\p{N}/u,
  special: /[^\p{L}\p{N}\s]/u,
};

export type Rule = keyof typeof RULES;

/** Whether `password` meets `rule`. */
export const conditionOf = (rule: Rule, password: string): ConditionState =>
  RULES[rule].test(password) ? "condition met" : "condition unmet";

const CONDITION = {
  default: { icon: EmptyIcon, tone: undefined, mark: undefined },
  "condition met": { icon: SuccessIcon, tone: "success", mark: "met" },
  "condition unmet": { icon: AlertIcon, tone: "alert", mark: "unmet" },
} as const;

/** A condition's field: its password's, without the field's id, tone or error, which are the field's own hint's. */
const CONDITION_FIELD = { field: true };

/**
 * Atoms/Form/Password Conditions: its words, a `rule` the password is checked against as it's typed; plain while the
 * password is focused empty. Its state's tone, never its field's.
 */
function PasswordInputCondition({ rule, children }: { rule: Rule; children: ReactNode }) {
  const password = useOwner(ConditionsContext, PasswordInputCondition);
  const state = password.plain ? "default" : conditionOf(rule, password.value);
  const { icon: Icon, tone, mark } = CONDITION[state];
  return (
    <li data-state={mark}>
      <FieldContext value={CONDITION_FIELD}>
        <Field.HintText tone={tone}>
          <Icon aria-hidden />
          {children}
        </Field.HintText>
      </FieldContext>
    </li>
  );
}

type Look = "Default" | "Active" | "Alert";

const lookState = (look: Look) => fieldState({ tone: look === "Alert" ? "alert" : undefined, active: look === "Active" }) ?? null;

const passwordBoxStyle = css(boxRaw);

// The show/hide button's 40px fills the box's end, its 10px padding included.
const eyeStyle = css({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  alignSelf: "stretch",
  flexShrink: 0,
  width: "2.5rem",
  marginInlineEnd: "-0.625rem",
  "&:is(button)": { cursor: "pointer" },
});

const conditionsStyle = css({
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: "var(--sw-gap-xs) var(--sw-gap-lg)",
  marginBlockStart: "var(--sw-margin-xs)",
});

type Password = { value: string; plain: boolean };

/** The password the conditions check, whether they show plain, and whether they show at all. */
const PasswordContext = createContext<(Password & { shown: boolean }) | null>(null);
const ConditionsContext = createContext<Password | null>(null);

/** Figma's Has Hint Text: the password's `Condition`s in two columns, while it's Active or Alert. */
function PasswordInputConditions({ children }: { children: ReactNode }) {
  const { shown, ...password } = useOwner(PasswordContext, PasswordInputConditions);
  if (!shown) return null;
  return (
    <ConditionsContext value={password}>
      <ul className={conditionsStyle}>{children}</ul>
    </ConditionsContext>
  );
}

/**
 * Molecules/Form/Password Input: its box, then its `Conditions` under it, which show while it's Active or Alert: plain
 * while it's focused empty and nothing's been typed, otherwise checked against what's in it, so one left blank has every
 * condition unmet. Alert whenever it holds a password with a condition unmet, in use or not. Otherwise, until it's first
 * focused it holds its field's tone (Alert's conditions show, checked); then it's Active while in use, and Alert once left
 * blank. Masked whenever it's left; its show/hide button shows only while it isn't Default. A field holding a demo's look
 * (`data-active`) holds it Active.
 */
function PasswordInputRoot({
  defaultValue = "",
  defaultMasked = false,
  children,
}: {
  defaultValue?: string;
  defaultMasked?: boolean;
  children?: ReactNode;
}) {
  const id = useId();
  const { tone, held } = use(FieldContext);
  const holding = held !== undefined;
  const [value, setValue] = useState(defaultValue);
  const [masked, setMasked] = useState(defaultMasked);
  const [touched, setTouched] = useState(false);
  const [focused, setFocused] = useState(false);
  const [typed, setTyped] = useState(false);
  const plain = focused && !typed && !value && tone !== "alert";
  const unmet = Object.keys(RULES).some((rule) => conditionOf(rule as Rule, value) === "condition unmet");
  const failing = value !== "" && unmet;
  const start: Look = tone === "alert" ? "Alert" : "Default";
  const look: Look = failing ? "Alert" : holding || focused ? "Active" : !touched ? start : unmet ? "Alert" : "Default";
  const field = useField({ state: touched || holding || failing ? lookState(look) : undefined, tone });
  const Eye = masked ? ShowIcon : HideIcon;
  return (
    <PasswordContext value={{ value, plain, shown: look !== "Default" }}>
      <Typography
        tag="div"
        variant="bodyLarge"
        className={passwordBoxStyle}
        data-box=""
        data-state={field.state}
        onFocus={() => {
          setTouched(true);
          setFocused(true);
        }}
        onBlur={(event) => {
          if (event.currentTarget.contains(event.relatedTarget)) return;
          setFocused(false);
          setMasked(true);
        }}
      >
        <input
          id={field.id ?? id}
          type={masked ? "password" : "text"}
          value={value}
          autoComplete="new-password"
          aria-describedby={field.hintId}
          onChange={(event) => {
            setValue(event.target.value);
            setTyped(true);
          }}
        />
        {look === "Default" ? (
          <span className={eyeStyle} />
        ) : (
          <button
            type="button"
            className={eyeStyle}
            aria-label={masked ? "Show" : "Hide"}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => setMasked(!masked)}
          >
            <Eye aria-hidden />
          </button>
        )}
      </Typography>
      {partsOf(children, PasswordInputConditions)}
    </PasswordContext>
  );
}

PasswordInputRoot.displayName = "PasswordInput";
PasswordInputConditions.displayName = "PasswordInput.Conditions";
PasswordInputCondition.displayName = "PasswordInput.Condition";

export const PasswordInput = Object.assign(PasswordInputRoot, {
  Conditions: ownPart(PasswordInputConditions),
  Condition: ownPart(PasswordInputCondition, "PasswordInput.Conditions"),
});

const digitStyle = css(boxRaw, { width: "2.25rem", "& input": { textAlign: "center" } });

const digitsStyle = css({ display: "flex", gap: "var(--sw-gap-xl)" });

type CodeState = {
  id: string;
  label?: string;
  look: (i: number) => Look;
  code: string[];
  put: (i: number, digit: string) => void;
  fill: (from: number, digits: string) => void;
  setFocus: (update: (was: number | null) => number | null) => void;
};

const CodeContext = createContext<CodeState | null>(null);
const DigitIndex = createContext(0);

/** Focuses digit `i`, kept within the code, of the code `input` is a digit of. */
function focusDigit(input: HTMLElement, i: number) {
  const digits = input.closest("[role=group]")!.querySelectorAll("input");
  digits[Math.max(0, Math.min(digits.length - 1, i))]?.focus();
}

/** Atoms/Form/Code Digit Input: one digit of its code, typing on to the next. */
function VerificationCodeInputDigit() {
  const { id, label, look, code, put, fill, setFocus } = useOwner(CodeContext, VerificationCodeInputDigit);
  const i = use(DigitIndex);
  const digit = code[i];
  return (
    <Typography
      tag="div"
      variant="bodyLarge"
      className={digitStyle}
      data-box=""
      data-state={lookState(look(i)) ?? undefined}
    >
      <input
        id={i === 0 ? id : `${id}-${i}`}
        aria-labelledby={label}
        inputMode="numeric"
        autoComplete="one-time-code"
        value={digit}
        onFocus={(event) => {
          setFocus(() => i);
          event.target.select();
        }}
        onBlur={() => setFocus((was) => (was === i ? null : was))}
        onChange={(event) => {
          const typed = event.target.value;
          const digits = typed.replace(/\D/g, "");
          if (!digits) {
            if (!typed) put(i, "");
            return;
          }
          // One digit typed beside the one already there.
          const next = digits.length === 2 && digit ? (digits[0] === digit ? digits[1] : digits[0]) : digits;
          fill(i, next);
          focusDigit(event.target, i + next.length);
        }}
        onPaste={(event) => {
          event.preventDefault();
          const digits = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, code.length - i);
          if (!digits) return;
          fill(i, digits);
          focusDigit(event.currentTarget, i + digits.length);
        }}
        onKeyDown={(event) => {
          if (event.key === "Backspace" && !digit && i > 0) {
            event.preventDefault();
            put(i - 1, "");
            focusDigit(event.currentTarget, i - 1);
          } else if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
            event.preventDefault();
            focusDigit(event.currentTarget, i + (event.key === "ArrowLeft" ? -1 : 1));
          }
        }}
      />
    </Typography>
  );
}

/**
 * Molecules/Form/Verification Code Input: its `Digit`s, each typed one moving on to the next, Backspace in an empty
 * one moving back, and a pasted code filling them all. Its field's Alert reddens every digit.
 */
function VerificationCodeInputRoot({ children }: { children: ReactNode }) {
  const own = useId();
  const digits = partsOf(children, VerificationCodeInputDigit);
  const [typed, setTyped] = useState<string[]>([]);
  const [focus, setFocus] = useState<number | null>(null);
  const field = useField({ active: focus !== null });
  const alert = field.tone === "alert";
  const id = field.id ?? own;
  const code = digits.map((_, i) => typed[i] ?? "0");

  const put = (i: number, digit: string) => setTyped(code.map((d, k) => (k === i ? digit : d)));
  const fill = (from: number, next: string) =>
    setTyped(code.map((d, k) => (k >= from && k < from + next.length ? next[k - from] : d)));
  const look = (i: number): Look => (alert ? "Alert" : i === focus ? "Active" : "Default");

  return (
    <div className={digitsStyle} role="group" aria-labelledby={field.labelId} aria-describedby={field.hintId}>
      <CodeContext value={{ id, label: field.labelId, look, code, put, fill, setFocus }}>
        {digits.map((digit, i) => (
          <DigitIndex key={digit.key ?? i} value={i}>
            {digit}
          </DigitIndex>
        ))}
      </CodeContext>
    </div>
  );
}

VerificationCodeInputRoot.displayName = "VerificationCodeInput";
VerificationCodeInputDigit.displayName = "VerificationCodeInput.Digit";

export const VerificationCodeInput = Object.assign(VerificationCodeInputRoot, { Digit: ownPart(VerificationCodeInputDigit) });

// File Upload's dashed box, which an Empty State shares.
const dashedBoxRaw = css.raw({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  padding: "var(--sw-padding-xl)",
  border: "1.5px dashed var(--sw-border-default)",
  borderRadius: "var(--sw-radius-md)",
  backgroundColor: "var(--sw-surface-subdued)",
  color: "var(--sw-glyph-subdued)",
  textAlign: "center",
});

const uploadStyle = css(dashedBoxRaw, {
  position: "relative",
  gap: "var(--sw-gap-md)",
  height: "12.5rem",
  overflow: "hidden",
  whiteSpace: "nowrap",
  cursor: "pointer",
  "&:has(> input:focus-visible)": { outline: "2px solid var(--sw-outline-focus)" },
  "&[data-state=active]": {
    borderColor: "var(--sw-border-target)",
    backgroundColor: "var(--sw-surface-target)",
    color: "var(--sw-glyph-target)",
  },
  // A drag then only ever enters and leaves the box itself: Safari's dragleave carries no relatedTarget.
  "&[data-state=active] *": { pointerEvents: "none" },
  "& > div": { display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--sw-gap-sm)" },
  "& > [data-dragging]": { gap: "var(--sw-gap-xs)" },
  "& > [data-dragging] > svg": { flexShrink: 0, marginBlockEnd: "calc(var(--sw-gap-md) - var(--sw-gap-xs))" },
});

/** Whether a file is being dragged over the box or one's been chosen, and the id that names its picker. */
const UploadContext = createContext<{ over: boolean; chosen: boolean; browse?: string } | null>(null);

const pickerStyle = css({ srOnly: true });

const SPREADSHEET = /\.(csv|xlsx?)$/i;

/**
 * Molecules/Form/File Upload: a CSV, XLS or XLSX file chosen with its `Browse` (or anywhere in the box), or dropped on
 * it, shows its name in place of its `Idle`. Its `Idle` shows until a file is dragged over it, then its `Dragging`,
 * while it's Active.
 */
function FileUploadRoot({ children }: { children: ReactNode }) {
  const browse = useId();
  const [over, setOver] = useState(false);
  const [chosen, setChosen] = useState<string | null>(null);
  const show = (file?: File) => {
    if (file && SPREADSHEET.test(file.name)) setChosen(file.name);
  };
  return (
    <UploadContext value={{ over, chosen: !!chosen, browse }}>
      <label
        className={uploadStyle}
        data-upload=""
        data-state={over ? "active" : undefined}
        onDragEnter={(event) => {
          event.preventDefault();
          setOver(true);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOver(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setOver(false);
          show(event.dataTransfer.files[0]);
        }}
      >
        <input
          type="file"
          accept=".csv,.xls,.xlsx"
          className={pickerStyle}
          aria-labelledby={browse}
          onChange={(event) => {
            show(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
        {children}
        {chosen && !over && (
          <div>
            <Typography variant="subheading">{chosen}</Typography>
          </div>
        )}
      </label>
    </UploadContext>
  );
}
FileUploadRoot.displayName = "FileUpload";

/** What the box says until a file is dragged over it or chosen. */
function Idle({ children }: { children: ReactNode }) {
  const { over, chosen } = useOwner(UploadContext, Idle);
  return over || chosen ? null : <div>{children}</div>;
}
Idle.displayName = "FileUpload.Idle";

/** What the box says while a file is dragged over it: its icon, then its words. */
function Dragging({ children }: { children: ReactNode }) {
  return useOwner(UploadContext, Dragging).over ? <div data-dragging="">{children}</div> : null;
}
Dragging.displayName = "FileUpload.Dragging";

/** The box's Browse files...: the words that name its picker, drawn as a Secondary button. */
function Browse({ children }: { children: ReactNode }) {
  const { browse } = useOwner(UploadContext, Browse);
  return (
    <Typography variant="metadata" id={browse} className={smallButtonStyle} data-emphasis="secondary">
      {children}
    </Typography>
  );
}
Browse.displayName = "FileUpload.Browse";

export const FileUpload = Object.assign(FileUploadRoot, {
  Idle: ownPart(Idle),
  Dragging: ownPart(Dragging),
  Browse: ownPart(Browse),
});

// As tall as File Upload.
const emptyStateStyle = css(dashedBoxRaw, { gap: "var(--sw-gap-xl)", minHeight: "12.5rem" });

/** What a list says before it holds anything, with the button that adds its first, in File Upload's box. */
export function EmptyState({ children }: { children: ReactNode }) {
  return <div className={emptyStateStyle}>{children}</div>;
}
