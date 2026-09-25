"use client";

import {
  Children,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
  useState,
  type ReactNode,
  type Ref,
} from "react";
import { usePropertiesPanelInset } from "@/hooks/use-properties-panel-inset";
import { propertiesPanel } from "../../../styled-system/recipes";
import { css, cx } from "../../../styled-system/css";
import { Button } from "./button";
import { Popover } from "./popover";
import { Typography } from "./typography";
import { Field } from "./input/field";
import AddIcon from "@/assets/icons/add.svg";
import RemoveIcon from "@/assets/icons/remove.svg";
import RightSidebarIcon from "@/assets/icons/right-sidebar.svg";
import BottomSheetIcon from "@/assets/icons/bottom-sheet.svg";

/** Spread onto the trigger, or the dismiss fires on pointerdown and the click reopens the panel. */
export const PROPERTIES_TRIGGER_ATTR = { "data-properties-trigger": "" };

const TRIGGER_SELECTOR = "[data-properties-trigger]";

/** Must match the `propertiesPanelOut` keyframe's duration. */
const EXIT_MS = 200;

/** One docked panel at a time: each new one asks these to leave. */
const openPanels = new Set<() => void>();

type PanelStyles = ReturnType<typeof propertiesPanel>;

type PanelContextValue = {
  styles: PanelStyles;
  onDismiss: () => void;
};

const PanelContext = createContext<PanelContextValue | null>(null);

function usePanel(component: string): PanelContextValue {
  const ctx = useContext(PanelContext);
  if (!ctx)
    throw new Error(`${component} must be used within <PropertiesPanel>.`);
  return ctx;
}

type SectionContextValue = {
  enabled: boolean;
  setEnabled: (next: boolean) => void;
  panelId: string;
  titleId: string;
};

const SectionContext = createContext<SectionContextValue | null>(null);

function useSection(component: string): SectionContextValue {
  const ctx = useContext(SectionContext);
  if (!ctx) {
    throw new Error(
      `${component} must be used within <PropertiesPanel.Section>.`,
    );
  }
  return ctx;
}

export interface PropertiesPanelHandle {
  /** Starts the closing slide; `onDismiss` follows once it ends. Close through this, not by unmounting. */
  dismiss: () => void;
}

export interface PropertiesPanelProps {
  ariaLabel: string;
  /** Fired once the panel has finished leaving, not when it is asked to close. */
  onDismiss: () => void;
  /** Also exempt from the outside-press dismiss, e.g. a portalled surface of the panel's own. */
  ignoreSelector?: string;
  /** Default true; false for a panel that is the page's settings. Escape and close still work. */
  dismissOnOutsidePointer?: boolean;
  /** Default true; false for a page that opens with the panel up and draws nothing before it. */
  animateInset?: boolean;
  ref?: Ref<PropertiesPanelHandle>;
  children: ReactNode;
}

/** Portalled, so no ancestor's overflow, transform or container-type becomes the box it docks to. */
function PropertiesPanelRoot({
  ariaLabel,
  onDismiss,
  ignoreSelector,
  dismissOnOutsidePointer,
  animateInset,
  ref,
  children,
}: PropertiesPanelProps) {
  const styles = propertiesPanel();

  // Every dismissal holds the panel through its exit slide before telling the consumer, which unmounts it.
  const [exiting, setExiting] = useState(false);
  const close = useCallback(() => setExiting(true), []);

  // The page takes its width back as soon as the panel is asked to leave, so both move together.
  usePropertiesPanelInset(!exiting, { animate: animateInset });
  useImperativeHandle(ref, () => ({ dismiss: close }), [close]);

  // One inspector at a time, asked on mount, so the arriving panel is the one that stays.
  useEffect(() => {
    for (const other of openPanels) other();
    openPanels.add(close);
    return () => {
      openPanels.delete(close);
    };
  }, [close]);

  // Through a ref, so a fresh `onDismiss` each render doesn't restart the timer.
  const dismissRef = useRef(onDismiss);
  useEffect(() => {
    dismissRef.current = onDismiss;
  }, [onDismiss]);

  useEffect(() => {
    if (!exiting) return;
    // A timer, not `animationend`: the animated node is the Popover's, which this never holds.
    const timer = setTimeout(() => dismissRef.current(), EXIT_MS);
    return () => clearTimeout(timer);
  }, [exiting]);

  return (
    <PanelContext.Provider value={{ styles, onDismiss: close }}>
      <Popover
        className={cx(styles.root, exiting && styles.exiting)}
        role="dialog"
        ariaLabel={ariaLabel}
        ignoreSelector={
          ignoreSelector
            ? `${TRIGGER_SELECTOR}, ${ignoreSelector}`
            : TRIGGER_SELECTOR
        }
        dismissOnOutsidePointer={dismissOnOutsidePointer}
        portal
        onDismiss={close}
      >
        {children}
      </Popover>
    </PanelContext.Provider>
  );
}

// A box of its own: in the `space-between` strip, a third child would sit centred.
const headerActionsStyle = css({
  display: "flex",
  alignItems: "center",
  gap: "xs",
});

export interface PropertiesPanelHeaderProps {
  children: ReactNode;
  /** Overrides the dismiss button's accessible name. */
  closeLabel?: string;
  /** Controls acting on what the title names, drawn before the dismiss button. */
  actions?: ReactNode;
}

function PropertiesPanelHeader({
  children,
  closeLabel = "Close properties panel",
  actions,
}: PropertiesPanelHeaderProps) {
  const { styles, onDismiss } = usePanel("PropertiesPanel.Header");
  return (
    <div className={styles.header}>
      <Typography tag="p" type="bodyLarge" className={styles.title}>
        {children}
      </Typography>
      <div className={headerActionsStyle}>
        {actions}
        <Button aria-label={closeLabel} onClick={onDismiss}>
          <PropertiesPanelDockIcon />
        </Button>
      </div>
    </div>
  );
}

// The dock glyph is chosen in CSS, not `isBottomSheetLayout()`: the query can't run on the server.
const railOnlyIconStyle = css({ _bottomSheet: { display: "none" } });
const sheetOnlyIconStyle = css({
  display: "none",
  _bottomSheet: { display: "block" },
});

function PropertiesPanelDockIcon() {
  return (
    <>
      <RightSidebarIcon aria-hidden className={railOnlyIconStyle} />
      <BottomSheetIcon aria-hidden className={sheetOnlyIconStyle} />
    </>
  );
}

export interface PropertiesPanelSectionProps {
  enabled?: boolean;
  defaultEnabled?: boolean;
  onEnabledChange?: (enabled: boolean) => void;
  children: ReactNode;
}

/** Open is the panel's state, not derived from the value, or clearing a field would unmount it. */
function PropertiesPanelSection({
  enabled: enabledProp,
  defaultEnabled = false,
  onEnabledChange,
  children,
}: PropertiesPanelSectionProps) {
  const { styles } = usePanel("PropertiesPanel.Section");
  const uid = useId();
  const [internal, setInternal] = useState(defaultEnabled);
  const enabled = enabledProp ?? internal;

  const ctx: SectionContextValue = {
    enabled,
    setEnabled: (next) => {
      if (enabledProp === undefined) setInternal(next);
      onEnabledChange?.(next);
    },
    panelId: `${uid}-panel`,
    titleId: `${uid}-title`,
  };

  return (
    <SectionContext.Provider value={ctx}>
      <div
        className={styles.section}
        data-property-section
        data-enabled={enabled ? "" : undefined}
      >
        {children}
      </div>
    </SectionContext.Provider>
  );
}

export interface PropertiesPanelSectionHeaderProps {
  icon?: ReactNode;
  /** Also labels the add/remove button. */
  children: string;
}

function PropertiesPanelSectionHeader({
  icon,
  children,
}: PropertiesPanelSectionHeaderProps) {
  const { styles } = usePanel("PropertiesPanel.SectionHeader");
  const { enabled, setEnabled, panelId, titleId } = useSection(
    "PropertiesPanel.SectionHeader",
  );

  return (
    <div className={styles.sectionHeader}>
      <div className={styles.sectionTitle}>
        {icon}
        <Typography tag="p" type="bodySmall" id={titleId}>
          {children}
        </Typography>
      </div>
      <Button
        aria-label={`${enabled ? "Remove" : "Add"} ${children.toLowerCase()}`}
        aria-expanded={enabled}
        aria-controls={enabled ? panelId : undefined}
        onClick={() => setEnabled(!enabled)}
      >
        {enabled ? <RemoveIcon aria-hidden /> : <AddIcon aria-hidden />}
      </Button>
    </div>
  );
}

export interface PropertiesPanelGroupProps {
  /** Also names the group of controls. */
  title: string;
  /** Controls acting on what the group names, at the strip's end. */
  actions?: ReactNode;
  children?: ReactNode;
}

const groupActionsStyle = css({
  display: "flex",
  alignItems: "center",
  gap: "xs",
});

/** An always-on titled section. Works outside a `PropertiesPanel` too, taking the recipe directly. */
function PropertiesPanelGroup({
  title,
  actions,
  children,
}: PropertiesPanelGroupProps) {
  const panel = useContext(PanelContext);
  const styles = panel?.styles ?? propertiesPanel();

  return (
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        <div className={styles.sectionTitle}>
          <Typography tag="p" type="bodySmall">
            {title}
          </Typography>
        </div>
        {actions && <div className={groupActionsStyle}>{actions}</div>}
      </div>
      {/* Counted, not truth-tested: a list of empties is still truthy. */}
      {Children.toArray(children).length > 0 && (
        <div className={styles.controlPanel} role="group" aria-label={title}>
          {children}
        </div>
      )}
    </section>
  );
}

export interface PropertiesPanelControlPanelProps {
  /** Only for a section with no header to be named by. */
  ariaLabel?: string;
  children: ReactNode;
}

function PropertiesPanelControlPanel({
  ariaLabel,
  children,
}: PropertiesPanelControlPanelProps) {
  const { styles } = usePanel("PropertiesPanel.ControlPanel");
  const { enabled, panelId, titleId } = useSection(
    "PropertiesPanel.ControlPanel",
  );
  if (!enabled) return null;
  return (
    <div
      id={panelId}
      role="group"
      // One name or the other: labelled by a heading never rendered is a broken name.
      aria-label={ariaLabel}
      aria-labelledby={ariaLabel ? undefined : titleId}
      className={styles.controlPanel}
    >
      {children}
    </div>
  );
}

export interface PropertiesPanelControlProps {
  label: ReactNode;
  children: ReactNode;
}

function PropertiesPanelControl({
  label,
  children,
}: PropertiesPanelControlProps) {
  usePanel("PropertiesPanel.Control");
  return (
    <Field size="sm" data-property-control>
      <Field.Label>{label}</Field.Label>
      {children}
    </Field>
  );
}

export interface PropertiesPanelTieProps {
  /** Stands in the action column the rows give up. */
  action: ReactNode;
  /** Two or more {@link PropertiesPanelControl}s. */
  children: ReactNode;
}

/** Several rows under one action; the recipe draws the bracket off `data-property-tie`. */
function PropertiesPanelTie({ action, children }: PropertiesPanelTieProps) {
  usePanel("PropertiesPanel.Tie");
  return (
    <div data-property-tie>
      <div data-property-tie-rows>{children}</div>
      <div data-property-tie-action>{action}</div>
    </div>
  );
}

export interface PropertiesPanelTextProps {
  value: string;
  onValueChange: (value: string) => void;
  ariaLabel: string;
  placeholder?: string;
  /** Lines the box starts at where `field-sizing: content` is unsupported. */
  rows?: number;
  maxLength?: number;
  className?: string;
}

/** A caption: it wraps like prose, but Enter is declined since the value is one line. */
function PropertiesPanelText({
  value,
  onValueChange,
  ariaLabel,
  placeholder,
  rows = 3,
  maxLength,
  className,
}: PropertiesPanelTextProps) {
  const { styles } = usePanel("PropertiesPanel.Text");
  return (
    <textarea
      aria-label={ariaLabel}
      placeholder={placeholder}
      rows={rows}
      maxLength={maxLength}
      value={value}
      className={cx(styles.text, className)}
      onChange={(event) => onValueChange(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.preventDefault();
      }}
    />
  );
}

export interface PropertiesPanelFooterProps {
  children: ReactNode;
}

function PropertiesPanelFooter({ children }: PropertiesPanelFooterProps) {
  const { styles } = usePanel("PropertiesPanel.Footer");
  return <div className={styles.footer}>{children}</div>;
}

export const PropertiesPanel = Object.assign(PropertiesPanelRoot, {
  Header: PropertiesPanelHeader,
  DockIcon: PropertiesPanelDockIcon,
  Section: PropertiesPanelSection,
  SectionHeader: PropertiesPanelSectionHeader,
  Group: PropertiesPanelGroup,
  ControlPanel: PropertiesPanelControlPanel,
  Control: PropertiesPanelControl,
  Tie: PropertiesPanelTie,
  Text: PropertiesPanelText,
  Footer: PropertiesPanelFooter,
});
