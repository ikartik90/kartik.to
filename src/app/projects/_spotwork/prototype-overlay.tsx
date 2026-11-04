"use client";

import { useEffect, useImperativeHandle, useLayoutEffect, useRef, useState, type CSSProperties, type Ref } from "react";
import { css, cx } from "../../../../styled-system/css";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import CrossIcon from "@/assets/icons/cross.svg";
import RightSidebarIcon from "@/assets/icons/right-sidebar.svg";
import { DemoCursor } from "@/components/demo/demo-cursor";
import type { AppHandle, Page } from "./check-ins-app";
import type { DesignSystemHandle } from "./design-system";
import type { Version } from "./new-shift";
import { shiftStart } from "./data";
import { BAR_HEIGHT, BrowserBar, type BarHistory } from "./browser-bar/browser-bar";
import { TourProvider } from "./tour";
import { EditCommentsToggle } from "./comment-editor";
import { AboutSheet, useMedia, useUpright, useWide } from "./about-sheet";
import { aboutOf } from "./about-stories";
import { NAV, PROJECTS, SIDEBAR } from "./copy";
import { glassStyle, ProjectDock, ProjectMenu, VersionBar, type Choice } from "./project-nav";
import { sheetRoom, useSheetTuning } from "./sheet-tuning";
import { useDemo } from "./demo";
import type { Geofence } from "./geofence";
import { closeOverlay, openOverlay } from "./overlay-motion";
import { Sky } from "./sky";
import { AppVeil } from "./app-veil";
import { useLiveApp } from "./use-live-app";

// The full-screen overlay. The app plays in a browser window on a sky (sky.tsx), which fills the overlay.
// Check-ins' and the design system's stories dock beside the window from 1440px and on a tablet on its side, lie under it
// on a touch screen upright, and float over its right side otherwise (about-sheet.tsx).

const dialogStyle = css({
  margin: 0,
  width: "100%",
  height: "100dvh",
  maxWidth: "none",
  maxHeight: "none",
  paddingBlock: 0,
  paddingInlineStart: 0,
  // Room for the About sheet's docked properties panel, sliding with it as the page does (globals.css).
  paddingInlineEnd: "var(--page-inset-end)",
  transition: "padding-inline-end 200ms ease-out",
  overflow: "hidden",
  overscrollBehavior: "none",
  backgroundColor: "transparent",
});

const layoutStyle = css({
  position: "relative",
  display: "grid",
  flex: "1 1 auto",
  minHeight: 0,
  overflow: "clip",
  // The docked sheet's room, from its cards' left edge, so the window centres between them and the left edge.
  "&[data-dockable]": {
    "@media screen and (min-width: 90rem), screen and (orientation: landscape) and (any-pointer: coarse) and (min-width: 64rem)": { gridTemplateColumns: "minmax(0, 1fr) var(--sheet-room)" },
  },
  // A touch screen upright scrolls the About sheet up over the window, which stays put with its ground and controls; all
  // share the one cell.
  "&[data-upright]": {
    gridTemplateColumns: "minmax(0, 1fr)",
    alignItems: "start",
    overflowY: "auto",
    overscrollBehavior: "none",
  },
});

const stageStyle = css({
  position: "relative",
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr)",
  gridTemplateRows: "minmax(0, 1fr)",
  minWidth: 0,
  minHeight: 0,
  padding: "4xl",
  // The window starts below the floating controls' row, kept clear at every width.
  paddingBlockStart: "calc(token(spacing.3xl) * 2 + token(spacing.4xl))",
  // And ends above the dock's menu, its pills inset in their glass.
  "&[data-dock]": { paddingBlockEnd: "calc(token(spacing.3xl) * 2 + token(spacing.4xl) + token(spacing.sm) * 2)" },
  // A phone's window takes all the room under the controls' row.
  "@media screen and (width < 51.25rem), screen and (height < 31.25rem)": {
    padding: "lg",
    paddingBlockStart: "calc(token(spacing.3xl) + token(spacing.4xl) + token(spacing.lg))",
  },
  // Turned on its side, the dock's controls stand either side of the window, which takes the full height.
  "&[data-sides]": {
    gridTemplateColumns: "auto minmax(0, 1fr) auto",
    columnGap: "lg",
    padding: "lg",
    paddingBlockStart: "lg",
  },
  // Upright: only as tall as the window, at the top, the About sheet straight under it.
  "&[data-upright]": {
    gridArea: "1 / 1",
    position: "sticky",
    insetBlockStart: 0,
    gridTemplateRows: "auto",
    paddingBlockEnd: 0,
  },
});

// The window's room, which it's fitted to and centred in; upright, the window's own shape, so it fits its width.
const roomStyle = css({
  gridRow: 1,
  display: "grid",
  placeItems: "center",
  minWidth: 0,
  minHeight: 0,
  "[data-sides] > &": { gridColumn: 2 },
  "[data-upright] > &": { aspectRatio: "8 / 5" },
});

// A press between its controls lands on the ground, as it does everywhere round the window.
const topRowStyle = css({
  position: "absolute",
  insetBlockStart: "3xl",
  insetInline: "3xl",
  display: "flex",
  alignItems: "center",
  gap: "md",
  pointerEvents: "none",
  // The dock centres the versions on the window; its controls never narrow past their own width.
  "&[data-centred]": { display: "grid", gridTemplateColumns: "1fr auto minmax(max-content, 1fr)" },
  // On its side, its controls go to the stage's own columns.
  "&[data-centred][data-sides]": { display: "contents" },
  // Upright, out of the window's stage and over the About sheet scrolled up under it.
  "&[data-upright]": {
    gridArea: "1 / 1",
    position: "sticky",
    insetBlockStart: "3xl",
    insetInline: "auto",
    marginBlockStart: "3xl",
    marginInline: "3xl",
    zIndex: 12,
  },
  // As tall as the open menu, which grows from its centre.
  "&[data-below]": {
    insetBlockStart: "auto",
    insetBlockEnd: "3xl",
    height: "calc(token(spacing.4xl) + token(spacing.sm) * 2)",
    justifyContent: "center",
  },
});

const barStyle = css({ gridColumn: 2, pointerEvents: "auto" });

const dockStyle = css({ pointerEvents: "auto" });

// A phone, either way round: narrower than `md`, or too short for a window between the controls and the dock. The
// styles write the same query out.
const PHONE = "screen and (width < 51.25rem), screen and (height < 31.25rem)";
// A phone on its side, too short for a row of controls over the window.
const SHORT = "screen and (height < 31.25rem)";

// On a phone upright the dock's menu leads the controls' row; on a phone on its side or a tablet upright, the dock does,
// level with Close.
const menuStyle = css({
  gridColumn: 1,
  justifySelf: "start",
  "[data-sides] > &": { gridRow: 1, alignSelf: "start", height: "token(spacing.4xl)" },
});

// The whole row, so the versions slide in unclipped.

// The docked sheet's Close stands in for them.
const controlsStyle = css({
  display: "flex",
  alignItems: "center",
  gap: "md",
  flexShrink: 0,
  pointerEvents: "auto",
  "&[data-dockable]": { "@media screen and (min-width: 90rem), screen and (orientation: landscape) and (any-pointer: coarse) and (min-width: 64rem)": { display: "none" } },
  "[data-centred] > &": { gridColumn: 3, justifySelf: "end" },
  // Close at the top of the window's right, About under it.
  "[data-sides] > &": {
    gridRow: 1,
    flexDirection: "column-reverse",
    justifyContent: "flex-end",
    alignItems: "flex-end",
  },
});

const aboutStyle = css({ borderRadius: "full" });

const groundStyle = css({
  position: "absolute",
  inset: 0,
  width: "100%",
  height: "100%",
  "[data-upright] > &": { gridArea: "1 / 1", position: "sticky", insetBlockEnd: "auto", height: "100dvh" },
});

const contentsStyle = css({ display: "contents" });

// A selected date's colours in SW Curie, reversed, as the site's cursor takes its own.
const SPOTWORK_CURSOR = css.raw({ "--cursor-ink": "var(--sw-glyph-selected)", "--cursor-edge": "var(--sw-surface-selected)" });

// Clipped, not hidden: the scaled app overflows it, and a hidden box can still be scrolled (Google's map scrolls it).
const windowStyle = css({
  position: "relative",
  overflow: "clip",
  borderRadius: "md",
  boxShadow: "0 0 0 0.5px var(--colors-border-image-outline)",
});

const scaledStyle = css({ display: "flex", flexDirection: "column", transformOrigin: "0 0" });

// Check-ins' versions are the app's company and admin pages; Shift scheduling's all open its Shifts page, each with
// its own New Shift; Activation is the admin's Activations page.
const PAGE_OF: Record<string, Page> = {
  company: "check-ins",
  admin: "dashboard",
  final: "shifts",
  recurrence: "shifts",
  old: "shifts",
  activation: "activations",
};
const IN_APP = ["check-ins", "activation-and-retention"];
const ACCENT = "var(--sw-colors-blue-ribbon-700)";

/** The design system's bar, going back and forward through its pages. */
const DesignSystemBar = (history: BarHistory) => (
  <BrowserBar url={windowOf("design-system")!.url} accent={ACCENT} history={history} />
);

/** The site a project's window shows, if it has one: the design system's own, or the app's dashboard. */
export function windowOf(project: string): { url: string; site: "app" | "design-system" } | undefined {
  if (project === "design-system") return { url: "design-system.spotwork.co", site: "design-system" };
  if (IN_APP.includes(project)) return { url: "dashboard.spotwork.co", site: "app" };
  return undefined;
}

/** The app's page for a project and its version, if the app shows it. */
export const pageOf = (choice: Choice): Page | undefined => PAGE_OF[choice.version ?? choice.project];

/** The browser window (bar and page together) at 1440 × 900, scaled down to fit a `room`-sized stage, never up. */
export function fitWindow(roomWidth: number, roomHeight: number) {
  const width = 1440;
  const height = 900;
  return { width, height, scale: Math.max(0, Math.min(1, roomWidth / width, roomHeight / height)) };
}

/**
 * The page's zoom: the window's width on screen over the page's in CSS pixels, taken as the nearest zoom the pixel
 * ratio allows on a 1×, 2× or 3× screen, since a sidebar or docked inspector widens the window past the page.
 */
export function browserZoom(outerWidth: number, innerWidth: number, pixelRatio: number) {
  const seen = outerWidth / innerWidth;
  if (!seen) return 1;
  return [1, 2, 3]
    .map((screen) => pixelRatio / screen)
    .reduce((best, next) => (Math.abs(next - seen) < Math.abs(best - seen) ? next : best));
}

/**
 * Whether the window's outer size still has the orientation the page had before it turned: an iPad's Safari resizes
 * the page first and its window about 120ms later, with no event then.
 */
export function midTurn(outerWidth: number, outerHeight: number, innerWidth: number, innerHeight: number) {
  return outerWidth > outerHeight !== innerWidth > innerHeight;
}

/**
 * Of a stage `room` long across a `viewport`, what it was at 100% (Safari's Actual Size) when the browser's zoomed out,
 * so the window fitted to it shrinks with the page instead of growing into the room that frees.
 */
export function roomAtActualSize(room: number, viewport: number, zoom: number) {
  return room - viewport * Math.max(0, 1 - zoom);
}

function useFit() {
  const room = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState({ width: 0, height: 0, scale: 0, roomWidth: 0 });
  useLayoutEffect(() => {
    const node = room.current;
    if (!node) return;
    // Turning keeps the zoom, so mid-turn it stays what it was.
    let zoom = 1;
    const measure = () => {
      const { outerWidth, outerHeight, innerWidth, innerHeight } = window;
      if (!midTurn(outerWidth, outerHeight, innerWidth, innerHeight))
        zoom = browserZoom(outerWidth, innerWidth, window.devicePixelRatio);
      setFit({
        ...fitWindow(
          roomAtActualSize(node.clientWidth, innerWidth, zoom),
          roomAtActualSize(node.clientHeight, innerHeight, zoom),
        ),
        roomWidth: node.clientWidth,
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return { room, ...fit };
}

/** Closes the overlay as its Close does, its closing played first. */
export type OverlayHandle = { close: () => void };

export function PrototypeOverlay({
  ref,
  open,
  onClose,
  themeClassName,
  initial,
  onProject,
  comments,
}: {
  ref?: Ref<OverlayHandle>;
  open: boolean;
  onClose: () => void;
  themeClassName: string;
  /** The project and version it opens on. */
  initial?: Choice;
  /** Each project it shows, from the one it opens on. */
  onProject?: (project: string) => void;
  /** False leaves the walk-through's comments out. */
  comments?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const opening = useRef<Animation[]>([]);
  const leaving = useRef(false);

  // The content opens it (OverlayContent).
  useLayoutEffect(() => {
    const node = dialog.current;
    if (!open && node?.open) node.close();
  }, [open]);

  const leave = () => {
    const node = dialog.current;
    if (!node?.open || leaving.current) return;
    leaving.current = true;
    closeOverlay(node, opening.current, () => {
      leaving.current = false;
      node.close();
    });
  };
  useImperativeHandle(ref, () => ({ close: leave }));

  // Escape closes an open menu or the About sheet (`data-escape-layer`, the last being the innermost), then the overlay.
  // Safari also cancels the dialog after a prevented Escape, so the press's second request is dropped.
  const collapsing = useRef(false);
  function requestClose() {
    if (collapsing.current) return;
    const layer = [...(dialog.current?.querySelectorAll("[data-escape-layer]") ?? [])]
      .filter((node) => !node.closest("[data-closing]"))
      .at(-1);
    if (!layer) return leave();
    collapsing.current = true;
    layer.dispatchEvent(new Event("escape-layer"));
    requestAnimationFrame(() => (collapsing.current = false));
  }

  return (
    <Dialog
      ref={dialog}
      motion="none"
      className={dialogStyle}
      aria-label={NAV.dialog}
      onClose={onClose}
      onRequestClose={requestClose}
    >
      {open && (
        <OverlayContent
          dialog={dialog}
          onReady={(node) => (opening.current = openOverlay(node))}
          onClose={leave}
          themeClassName={themeClassName}
          initial={initial}
          onProject={onProject}
          comments={comments}
        />
      )}
    </Dialog>
  );
}

function OverlayContent({
  dialog,
  onReady,
  onClose,
  themeClassName,
  initial = { project: "check-ins", version: "company" },
  onProject,
  comments,
}: {
  dialog: React.RefObject<HTMLDialogElement | null>;
  /** Once the window's in, for the opening to play. */
  onReady: (dialog: HTMLDialogElement) => void;
  onClose: () => void;
  themeClassName: string;
  initial?: Choice;
  onProject?: (project: string) => void;
  comments?: boolean;
}) {
  const phone = useMedia(PHONE);
  // The dock's projects stay out until the first press, key or scroll in the overlay.
  const [untouched, setUntouched] = useState(true);
  useEffect(() => {
    const node = dialog.current;
    if (!node || !untouched) return;
    const touch = () => setUntouched(false);
    const events = ["pointerdown", "keydown", "wheel"];
    events.forEach((type) => node.addEventListener(type, touch, { capture: true, passive: true }));
    return () => events.forEach((type) => node.removeEventListener(type, touch, { capture: true }));
  }, [dialog, untouched]);
  const sides = useMedia(SHORT);
  // Opened before the window's room is measured, so the window is there from the first frame. Found from the layout,
  // as the dialog's own ref isn't set yet when both mount together.
  const layout = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const node = layout.current?.closest("dialog");
    if (node && !node.open) node.showModal();
  }, []);
  const { room, width, height, scale, roomWidth } = useFit();
  const ready = useRef(false);
  useLayoutEffect(() => {
    const node = layout.current?.closest("dialog");
    if (scale <= 0 || ready.current || !node) return;
    ready.current = true;
    onReady(node);
  }, [scale, onReady]);
  // The afternoon shift started 30–59 minutes ago, so the walkthrough is always early in it. Not in the server's
  // markup: the app and the comments that show it render after mount.
  const [anchor] = useState(() => shiftStart(new Date()));
  // The app's projects share the one app and the design system has its own site; each has a story.
  const [choice, setChoice] = useState<Choice>(initial);
  useEffect(() => onProject?.(choice.project), [choice.project, onProject]);
  const story = aboutOf(choice.project);
  const site = windowOf(choice.project);
  // The Shift scheduling version last shown, which the app's own Shifts item goes back to.
  const [shiftVersion, setShiftVersion] = useState<Version>("final");
  // The app's page, which it opens on again when Play starts it afresh.
  const [page, setPage] = useState(() => pageOf(choice));
  const app = useRef<AppHandle>(null);
  const designSystem = useRef<DesignSystemHandle>(null);
  const windowBox = useRef<HTMLDivElement>(null);
  const demo = useDemo(windowBox);
  const [runs, setRuns] = useState(0);
  // What the app starts with beyond its seed, where the demo played last needs it.
  const [fences, setFences] = useState<Record<string, Geofence>>();
  // The window's frame, the dock and the About sheet draw at once; the app comes in once its code has.
  const live = useLiveApp();
  const playable = !!live?.demoOf(choice, () => null);
  const choose = (next: Choice) => {
    setChoice(next);
    if (pageOf(next) === "shifts") setShiftVersion(next.version as Version);
  };

  const docked = useWide() && !!story;
  const upright = useUpright() && !!story;
  // Upright or on a phone, the dock leads the controls' row rather than standing under the window.
  const inRow = phone || upright;
  const [about, setAbout] = useState(false);
  if (about && (docked || upright)) setAbout(false);
  const aboutButton = useRef<HTMLButtonElement>(null);
  const [tuning] = useSheetTuning();
  // Where the About sheet under the window starts.
  const stage = useRef<HTMLDivElement>(null);
  const [stageHeight, setStageHeight] = useState(0);
  useLayoutEffect(() => {
    const node = stage.current;
    if (!node) return;
    const observer = new ResizeObserver(() => setStageHeight(node.offsetHeight));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const navigate = (next: Choice) => {
    demo.stop();
    choose(next);
    setAbout(false);
    const to = pageOf(next);
    if (!to) return;
    setPage(to);
    app.current?.go(to);
  };

  // Play starts the app afresh on its page, so its demo (the version's own, or the one `name`d) finds the page as it
  // opens, and goes to its own from there.
  const playIn = (next: Choice, name?: string) => {
    if (!live) return;
    choose(next);
    setAbout(false);
    setFences(live.demoFencesOf(next, name));
    setRuns((count) => count + 1);
    demo.play(live.demoOf(next, () => windowBox.current, name) ?? []);
  };

  // Upright, the controls leave the window's stage, which the About sheet covers as it scrolls up.
  const controls = (
    <div
      className={topRowStyle}
      data-centred=""
      data-sides={sides ? "" : undefined}
      data-upright={upright ? "" : undefined}
      data-overlay-motion="controls"
    >
      {inRow &&
        (phone && !sides ? (
          <ProjectMenu className={cx(dockStyle, menuStyle)} projects={PROJECTS} value={choice} onChange={navigate} />
        ) : (
          <ProjectDock
            className={cx(dockStyle, menuStyle)}
            projects={PROJECTS}
            value={choice}
            onChange={navigate}
            held={upright && untouched}
            fromStart
          />
        ))}
      {/* The About sheet plays its project's versions from its cards instead, docked or floating. */}
      {!story && (
        <VersionBar
          className={barStyle}
          projects={PROJECTS}
          value={choice}
          onChange={navigate}
          onPlay={playable ? () => playIn(choice) : undefined}
        />
      )}
      <div className={controlsStyle} data-dockable={story ? "" : undefined}>
        {story &&
          !upright &&
          (sides ? (
            <Button
              ref={aboutButton}
              variant="icon"
              emphasis="glass"
              shape="circle"
              aria-label={SIDEBAR.open}
              aria-expanded={about}
              onClick={() => setAbout(true)}
            >
              <RightSidebarIcon aria-hidden />
            </Button>
          ) : (
            <Button ref={aboutButton} className={cx(glassStyle, aboutStyle)} aria-expanded={about} onClick={() => setAbout(true)}>
              {SIDEBAR.open}
              <RightSidebarIcon aria-hidden />
            </Button>
          ))}
        {upright && <EditCommentsToggle />}
        <Button variant="icon" emphasis="glass" shape="circle" aria-label="Close" onClick={onClose}>
          <CrossIcon aria-hidden />
        </Button>
      </div>
    </div>
  );

  return (
    <TourProvider root={dialog} hidden={demo.playing} comments={comments}>
      <div
        ref={layout}
        className={layoutStyle}
        style={
          {
            "--sheet-room": `${sheetRoom(tuning)}px`,
            "--stage-height": `${stageHeight}px`,
            // The room either side of the window in its stage, which the docked sheet's scroll reaches into.
            "--window-slack": `${Math.max(0, (roomWidth - width * scale) / 2)}px`,
          } as CSSProperties
        }
        data-dockable={story ? "" : undefined}
        data-upright={upright ? "" : undefined}
      >
        <Sky className={groundStyle} />
        <div
          ref={stage}
          className={stageStyle}
          data-tour-bounds=""
          data-dock={!inRow ? "" : undefined}
          data-sides={sides ? "" : undefined}
          data-upright={upright ? "" : undefined}
          onClick={about ? () => setAbout(false) : undefined}
        >
          <div ref={room} className={roomStyle}>
            {site && scale > 0 && (
              <div
                ref={windowBox}
                className={windowStyle}
                style={{ width: width * scale, height: height * scale }}
                data-overlay-motion="window"
              >
                <div
                  className={cx(scaledStyle, themeClassName)}
                  style={{ width, height, transform: `scale(${scale})`, "--window-scale": scale } as CSSProperties}
                >
                  {/* The design system's site draws its own bar once it's here. */}
                  {(site.site === "app" || !live) && <BrowserBar url={site.url} accent={ACCENT} />}
                  {live && (
                    <live.GeoContext value={live.ONLINE}>
                      {site.site === "design-system" ? (
                        <live.DesignSystem
                          ref={designSystem}
                          width={width}
                          height={height - BAR_HEIGHT}
                          bar={DesignSystemBar}
                        />
                      ) : (
                        <live.CheckInsApp
                          key={runs}
                          ref={app}
                          fences={fences}
                          anchor={anchor}
                          width={width}
                          height={height - BAR_HEIGHT}
                          initialPage={page}
                          shiftVersion={shiftVersion}
                          onPage={(page) => {
                            setPage(page);
                            choose(
                              page === "shifts" || page === "pool"
                                ? { project: "activation-and-retention", version: shiftVersion }
                                : page === "activations" || page === "presets"
                                  ? { project: "activation-and-retention", version: "activation" }
                                  : { project: "check-ins", version: page === "dashboard" ? "admin" : "company" },
                            );
                          }}
                        />
                      )}
                    </live.GeoContext>
                  )}
                </div>
                <AppVeil shown={!!live} className={themeClassName} style={{ insetBlockStart: BAR_HEIGHT * scale }} />
                {/* Outside the scaled app, so it's drawn at its own size wherever the window's scale lands; in its theme,
                    boxless, for Spotwork's colours. */}
                <div className={cx(themeClassName, contentsStyle)}>
                  <DemoCursor {...demo.cursor} css={SPOTWORK_CURSOR} />
                </div>
              </div>
            )}
          </div>
          {!upright && controls}
          {!inRow && (
            <div className={topRowStyle} data-below="" data-overlay-motion="controls">
              <ProjectDock
                className={dockStyle}
                projects={PROJECTS}
                value={choice}
                onChange={navigate}
                held={untouched}
              />
            </div>
          )}
        </div>
        {upright && controls}

        <AboutSheet
          open={about}
          project={story}
          dockable={!!story}
          onClose={docked ? onClose : () => setAbout(false)}
          opener={aboutButton}
          onPlay={story ? ({ version, name }) => playIn({ project: story, version }, name) : undefined}
          onGo={({ page, target }) => designSystem.current?.go(page, target)}
        />
      </div>
    </TourProvider>
  );
}
