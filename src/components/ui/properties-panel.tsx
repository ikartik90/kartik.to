"use client";

import {
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
import { cx } from "../../../styled-system/css";
import { Button } from "./button";
import { Popover } from "./popover";
import { Typography } from "./typography";
import { Field } from "./input/field";
import AddIcon from "@/assets/icons/add.svg";
import RemoveIcon from "@/assets/icons/remove.svg";
import RightSidebarIcon from "@/assets/icons/right-sidebar.svg";

// ---------------------------------------------------------------------------
// PropertiesPanel — the docked inspector, composed the way the rest of the
// system composes (Figma 845:7223):
//
//   <PropertiesPanel ariaLabel="Media properties" onDismiss={close}>
//     <PropertiesPanel.Header>Media Properties</PropertiesPanel.Header>
//
//     <PropertiesPanel.Section
//       defaultEnabled={Boolean(caption)}
//       onEnabledChange={(on) => !on && clearCaption()}
//     >
//       <PropertiesPanel.SectionHeader icon={<EditIcon />}>
//         Caption
//       </PropertiesPanel.SectionHeader>
//       <PropertiesPanel.ControlPanel>
//         <PropertiesPanel.Text value={caption} onValueChange={setCaption} />
//       </PropertiesPanel.ControlPanel>
//     </PropertiesPanel.Section>
//   </PropertiesPanel>
//
// Three nestings of one shape — a 40px header strip over a body. The panel is
// a header over its sections; a section is a header over its control panel; a
// control panel is a column of rows. Each level is a part, so a new section is
// a new `<Section>` and a new control is a new `<Control>`, with nothing to
// widen and no shape prop to extend.
//
// A section's control panel is MOUNTED, not hidden: enabling adds it to the
// DOM and disabling takes it away, which is what makes the add/remove pair
// honest — a collapsed section holds no focusable controls to tab into and no
// stale values to read back.
//
// A section that is ALWAYS on is the same part with its header left off and
// `enabled` held true (Figma 885:1963) — the properties every picture has,
// which are not something you add or remove. Its control panel takes an
// `ariaLabel` instead, since there is no heading left to be named by.
//
// The panel knows nothing about what it is inspecting. `Section` owns only
// whether it is open (uncontrolled by default, like Slider and Switch) and
// reports the change; what enabling MEANS — applying a default gradient,
// clearing a caption — belongs to the consumer that has the document.
//
// Whatever opens the panel must mark itself {@link PROPERTIES_TRIGGER_ATTR},
// or it cannot be the thing that closes it — see the constant.
// ---------------------------------------------------------------------------

/**
 * Spread onto the control that opens the panel:
 *
 *   <Button {...PROPERTIES_TRIGGER_ATTR} onClick={toggle} />
 *
 * It exempts that control from the outside-pointerdown dismiss. Without it a
 * toggling trigger can only ever OPEN: the dismiss runs on pointerdown, the
 * click arrives to find the panel already closed, and re-opens it — which
 * reads as the button doing nothing at all.
 */
export const PROPERTIES_TRIGGER_ATTR = { "data-properties-trigger": "" };

const TRIGGER_SELECTOR = "[data-properties-trigger]";

/**
 * How long the panel takes to slide back out. Kept in step with the
 * `propertiesPanelOut` keyframe in `panda.config.ts`.
 */
const EXIT_MS = 200;

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
  /** Ties the section header's toggle to the panel it mounts, via aria-controls. */
  panelId: string;
  /**
   * The heading the control panel is named by. An ID rather than the string
   * itself: the name is authored in the header and READ in the panel, and
   * passing the text back up would mean a child writing to its parent's state
   * during render.
   */
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

/** What a `ref` on the panel gets you: the way to close it from outside. */
export interface PropertiesPanelHandle {
  /**
   * Start the closing slide. `onDismiss` follows when it is over — so the
   * trigger that opened the panel closes it through HERE rather than by
   * dropping it from the tree, which would take the animation with it.
   */
  dismiss: () => void;
}

export interface PropertiesPanelProps {
  /** Names the dialog for assistive technology. */
  ariaLabel: string;
  /**
   * Fired once the panel has finished leaving — the point at which the
   * consumer should stop rendering it. NOT the moment it was asked to close.
   */
  onDismiss: () => void;
  ref?: Ref<PropertiesPanelHandle>;
  children: ReactNode;
}

/**
 * The docked shell: Escape / outside-pointer dismissal from the shared
 * {@link Popover}, portalled to the body so no ancestor's `overflow`,
 * `transform` or `container-type` can clip it or steal its containing block —
 * the panel is fixed to the VIEWPORT, and a demo frame or a scroll container
 * around the thing being edited must not become the box it docks to.
 */
function PropertiesPanelRoot({
  ariaLabel,
  onDismiss,
  ref,
  children,
}: PropertiesPanelProps) {
  const styles = propertiesPanel();

  // The panel LEAVES the way it arrived, which means it has to outlive the
  // decision to close it: the consumer unmounts it the moment `onDismiss`
  // fires, and an unmounted node has nothing to animate. So every dismissal
  // routes through here first, holds the panel on screen for the length of
  // the slide, and only then tells the consumer.
  const [exiting, setExiting] = useState(false);
  const close = useCallback(() => setExiting(true), []);

  // The page gives up the width the panel is about to occupy, and takes it back
  // the moment the panel is asked to leave rather than when it has gone — so
  // the content expands across the same 200ms the panel spends sliding out,
  // instead of snapping open behind it.
  usePropertiesPanelInset(!exiting);
  // Escape, the header button, a press outside, and the trigger that opened
  // it all end up here — so the panel leaves the same way whichever of them
  // asked, and the timing lives in exactly one place.
  useImperativeHandle(ref, () => ({ dismiss: close }), [close]);

  // Read through a ref so the timer is started by the EXIT, not restarted by
  // a consumer that hands down a fresh arrow on every render.
  const dismissRef = useRef(onDismiss);
  useEffect(() => {
    dismissRef.current = onDismiss;
  }, [onDismiss]);

  useEffect(() => {
    if (!exiting) return;
    // A clock rather than `animationend`: the animated element is the shared
    // Popover's node, which this component never holds. Under
    // `prefers-reduced-motion` globals.css collapses the slide to 0.01ms, so
    // the panel is off screen immediately either way and the wait costs
    // nothing anyone can see.
    const timer = setTimeout(() => dismissRef.current(), EXIT_MS);
    return () => clearTimeout(timer);
  }, [exiting]);

  return (
    <PanelContext.Provider value={{ styles, onDismiss: close }}>
      <Popover
        className={cx(styles.root, exiting && styles.exiting)}
        role="dialog"
        ariaLabel={ariaLabel}
        ignoreSelector={TRIGGER_SELECTOR}
        portal
        onDismiss={close}
      >
        {children}
      </Popover>
    </PanelContext.Provider>
  );
}

export interface PropertiesPanelHeaderProps {
  /** The panel's title. */
  children: ReactNode;
  /** Overrides the dismiss button's accessible name. */
  closeLabel?: string;
}

/** Title over the whole panel, with the control that sends it back to the edge. */
function PropertiesPanelHeader({
  children,
  closeLabel = "Close properties panel",
}: PropertiesPanelHeaderProps) {
  const { styles, onDismiss } = usePanel("PropertiesPanel.Header");
  return (
    <div className={styles.header}>
      <Typography tag="p" type="bodyLarge" className={styles.title}>
        {children}
      </Typography>
      <Button aria-label={closeLabel} onClick={onDismiss}>
        <RightSidebarIcon aria-hidden />
      </Button>
    </div>
  );
}

export interface PropertiesPanelSectionProps {
  /** Controlled open state. Omit to let the section own it. */
  enabled?: boolean;
  /** Initial open state when uncontrolled — typically "the property is set". */
  defaultEnabled?: boolean;
  /** Fired when the add/remove button flips the section. */
  onEnabledChange?: (enabled: boolean) => void;
  children: ReactNode;
}

/**
 * One property group: a header strip and — once enabled — the control panel it
 * mounts.
 *
 * Uncontrolled by default, and that is the load-bearing choice rather than a
 * convenience. Deriving "open" from the value it edits would make a section
 * close itself the moment its value went empty — a caption unmounting its own
 * field on the keystroke that cleared it. Open is a fact about the PANEL; the
 * value is a fact about the document.
 */
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
  /** Bare `<Icon />`; sized and tinted by the recipe. */
  icon?: ReactNode;
  /** The section's name — also what the add/remove button is labelled with. */
  children: string;
}

/**
 * The section's name and its one control: add to open the section, remove to
 * close it. Both are the SAME button — a section is either open or it is not,
 * and two buttons where one is always inert would be two hit targets for one
 * piece of state.
 */
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
        // Only ever points at a panel that exists — a dangling `aria-controls`
        // is worse than none.
        aria-controls={enabled ? panelId : undefined}
        onClick={() => setEnabled(!enabled)}
      >
        {enabled ? <RemoveIcon aria-hidden /> : <AddIcon aria-hidden />}
      </Button>
    </div>
  );
}

export interface PropertiesPanelControlPanelProps {
  /**
   * Names the group when its section has no {@link PropertiesPanelSectionHeader}
   * to be named by — an always-on section, which carries no add/remove control
   * and so draws no header at all (Figma 885:1963). Omit it whenever there IS a
   * header: the heading is the visible name, and a second one would win over it.
   */
  ariaLabel?: string;
  children: ReactNode;
}

/** The section's controls — in the DOM only while its section is enabled. */
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
      // One name or the other, never both and never neither: pointing
      // `aria-labelledby` at a heading that was never rendered is a group with
      // a BROKEN name, which reads worse than an unnamed one.
      aria-label={ariaLabel}
      aria-labelledby={ariaLabel ? undefined : titleId}
      className={styles.controlPanel}
    >
      {children}
    </div>
  );
}

export interface PropertiesPanelControlProps {
  /** The row's label, wired to the control by the field's own `htmlFor`. */
  label: ReactNode;
  /** A field-family control — Slider, ColorInput, Field.Frame, … */
  children: ReactNode;
}

/**
 * One labelled row. A real {@link Field}, relaid by the recipe from the field's
 * vertical stack into the panel's label ∣ control grid — so every control keeps
 * the native label association it would have anywhere else in the system, and a
 * new row is a new `<Control>` with nothing else to touch.
 */
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

export interface PropertiesPanelTextProps {
  value: string;
  onValueChange: (value: string) => void;
  ariaLabel: string;
  placeholder?: string;
  /** Lines the box starts at where `field-sizing: content` is unsupported. */
  rows?: number;
  className?: string;
}

/**
 * Prose filling the control panel rather than a value in a labelled row — the
 * caption case (Figma 885:2249). A `<textarea>` because a caption WRAPS, and a
 * single-line input would hide everything past its right edge; Enter is
 * declined because the value is still one line of text.
 */
function PropertiesPanelText({
  value,
  onValueChange,
  ariaLabel,
  placeholder,
  rows = 3,
  className,
}: PropertiesPanelTextProps) {
  const { styles } = usePanel("PropertiesPanel.Text");
  return (
    <textarea
      aria-label={ariaLabel}
      placeholder={placeholder}
      rows={rows}
      value={value}
      className={cx(styles.text, className)}
      onChange={(event) => onValueChange(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.preventDefault();
      }}
    />
  );
}

export const PropertiesPanel = Object.assign(PropertiesPanelRoot, {
  Header: PropertiesPanelHeader,
  Section: PropertiesPanelSection,
  SectionHeader: PropertiesPanelSectionHeader,
  ControlPanel: PropertiesPanelControlPanel,
  Control: PropertiesPanelControl,
  Text: PropertiesPanelText,
});
