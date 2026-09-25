"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { css } from "../../../../styled-system/css";
import { hotkey, menuIcon } from "../../../../styled-system/recipes";
import InfoIcon from "@/assets/icons/info.svg";
import TrashIcon from "@/assets/icons/trash.svg";
import { isBottomSheetLayout } from "@/data/media-queries";
import { useTrickleProgress } from "@/hooks/use-demo-loader";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { PlaygroundChrome } from "@/components/playground-chrome";
import { ScrimBlur } from "@/components/scrim-blur";
import { SearchField } from "@/components/search-field";
import { Button } from "@/components/ui/button";
import { ProgressBar } from "@/components/ui/progress-bar";
import { PropertiesPanel } from "@/components/ui/properties-panel";
import { PANEL_RESERVED_ATTR } from "@/hooks/use-properties-panel-inset";
import { Tooltip } from "@/components/ui/tooltip";
import { Typography } from "@/components/ui/typography";
import {
  DEFAULT_ICON_SETTINGS,
  iconSettingsLockedTo,
  matchesIcon,
  type IconViewSettings,
} from "@/domain/icon";
import {
  archiveNameFor,
  downloadPlanFor,
  iconFilesFor,
  saveDownload,
} from "./icon-download";
import { IconGrid, MarqueeBand } from "./icon-grid";
import { preloaderPercent } from "./icon-progress";
import { IconsPanel } from "./icons-panel";
import type { PrerenderedIcon } from "@/lib/icons";
import { useIconDrop } from "./use-icon-drop";
import { useIconLibrary } from "./use-icon-library";
import { useIconMarquee } from "./use-icon-marquee";

const BAR_INSET = "token(spacing.3xl)";
const BAR_ROW = "token(spacing.4xl)";
const BAR_LEDGE = "token(sizes.toolbarButton)";
/** How far the ledge tucks under the pill, hiding its square bottom corners. */
const BAR_LEDGE_OVERLAP = "token(spacing.xxs)";
const BAR_HEIGHT = `calc(${BAR_LEDGE} + ${BAR_ROW} - ${BAR_LEDGE_OVERLAP})`;
const BAR_WIDTH = "min(480px, calc(100dvw - 2 * token(spacing.3xl)))";
const SCRIM_CLEARANCE = "token(spacing.3xl)";
const BAR_SPACE = `calc(${BAR_INSET} + ${BAR_HEIGHT} + ${SCRIM_CLEARANCE})`;

// Past the band's top edge too: the blur samples beyond its box and would smear the last row.
const CANVAS_FOOT = `calc(${BAR_SPACE} + ${SCRIM_CLEARANCE})`;

// `padding: none` overrides the site's own padding on `main` (globals.css).
const pageStyle = css({
  minHeight: "100dvh",
  backgroundColor: "bg.canvas",
  padding: "none",
  position: "relative",
  "--chrome-band": "token(spacing.5xl)",
  _bottomSheet: {
    "--chrome-band": "calc(token(spacing.md) + token(spacing.4xl))",
  },
  scrollPaddingTop: `calc(var(--chrome-band) + ${SCRIM_CLEARANCE})`,
});

// Unselectable: a drag would otherwise highlight the tiles' hidden names.
const canvasStyle = css({
  position: "relative",
  userSelect: "none",
  // Grow, not `min-height`: `main` is a flex column and would shrink a floor back to 100dvh.
  flexGrow: 1,
  flexShrink: 0,
  paddingBlockStart: `calc(var(--chrome-band) + ${SCRIM_CLEARANCE})`,
  paddingBlockEnd: CANVAS_FOOT,
  display: "flex",
  flexDirection: "column",
  gap: "xl",
});

const emptyStyle = css({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: `calc(100dvh - var(--chrome-band) - ${SCRIM_CLEARANCE} - ${CANVAS_FOOT})`,
  color: "text.body",
  textAlign: "center",
});

const barScrimStyle = css({
  position: "fixed",
  insetInlineStart: 0,
  insetBlockEnd: 0,
  right: "var(--page-inset-end, 0px)",
  height: BAR_SPACE,
  backgroundImage:
    "linear-gradient(to top, token(colors.bg.canvas), transparent)",
  pointerEvents: "none",
  zIndex: 1,
  transition: "right 200ms ease-out",
});

const barStyle = css({
  position: "fixed",
  insetBlockEnd: BAR_INSET,
  left: "calc(50% - var(--page-inset-end, 0px) / 2)",
  translate: "-50% 0",
  zIndex: 2,
  display: "flex",
  flexDirection: "column",
  width: BAR_WIDTH,
  transition: "left 200ms ease-out",
});

const barFieldStyle = css({
  display: "flex",
  flexDirection: "column",
  borderRadius: "md",
  borderWidth: "token(spacing.3xs)",
  borderStyle: "solid",
  borderColor: "field.border.default",
  backgroundColor: "bg.surface",
  "--colors-field-bg-default": "var(--colors-field-bg-default-on-surface)",
  boxShadow:
    "0 4px 16px color-mix(in srgb, var(--colors-neutral-900) 12%, transparent)",
  color: "field.text.default",
});

const barLedgeSlotStyle = css({
  display: "flex",
  justifyContent: "center",
  paddingInline: "lg",
  marginBlockEnd: `calc(-1 * ${BAR_LEDGE_OVERLAP})`,
});

const barLedgeStyle = css({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "sm",
  flex: "1 1 0",
  minWidth: 0,
  height: BAR_LEDGE,
  paddingInline: "md",
  borderTopRadius: "sm",
  // Opaque: the ledge has no surface under it, and the grid would show through.
  backgroundColor: "bg.surfaceRaised",
  // An inset ring, not a border, which would eat into the 28px.
  boxShadow:
    "inset 0 0 0 token(spacing.3xs) var(--colors-field-border-default)",
  overflow: "hidden",
  // An alpha, not `field.text.muted`, which is pre-mixed against `bg.surface`.
  color: "field.text.default/50",
  textStyle: "caption",
  whiteSpace: "nowrap",
});

// A flex row so the key chip sits upright; keep the spaces in the strings for `textContent`.
const barHintTextStyle = css({
  display: "flex",
  alignItems: "center",
  gap: "sm",
  minWidth: 0,
});

const barLedgeIconStyle = menuIcon();

const barHintKeyStyle = hotkey({ surface: "menu" });

const preloaderStyle = css({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: "min(token(sizes.imagePreviewMax), token(spacing.full))",
  marginInline: "auto",
});

// Fixed, and never a drop target: it would fire its own enter/leave (see `use-icon-drop`).
const dropOverlayStyle = css({
  position: "fixed",
  insetBlockStart: "var(--chrome-band)",
  insetBlockEnd: 0,
  insetInlineStart: 0,
  right: "var(--page-inset-end, 0px)",
  zIndex: 3,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "3xl",
  pointerEvents: "none",
  // The blur is in globals.css: Panda emits only `-webkit-backdrop-filter`, which Chromium ignores.
  backgroundColor: "bg.canvas/40",
});

const dropFrameStyle = css({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: "token(spacing.full)",
  height: "token(spacing.full)",
  borderRadius: "md",
  borderWidth: "token(spacing.xxs)",
  borderStyle: "dashed",
  borderColor: "text.body/30",
  color: "text.body",
  textAlign: "center",
});

const triggerStyle = css({
  position: "fixed",
  insetBlockStart: "xxl",
  insetInlineEnd: "xxl",
  zIndex: 2,
});

export interface IconsPlaygroundProps {
  prerendered?: readonly PrerenderedIcon[];
}

export function IconsPlayground({ prerendered = [] }: IconsPlaygroundProps) {
  const isAdmin = useIsAdmin();
  const library = useIconLibrary(prerendered);

  const [settings, setSettings] = useState<IconViewSettings>(DEFAULT_ICON_SETTINGS);
  const [open, setOpen] = useState(true);

  // Set after mount (no viewport on the server); `open` starts true so the rail's inset is in the server HTML.
  const [sheet, setSheet] = useState(false);
  useEffect(() => {
    if (!isBottomSheetLayout()) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSheet(true);
    setOpen(false);
  }, []);
  // Held here: the panel unmounts on dismiss.
  const [locked, setLocked] = useState(true);
  const [selection, setSelection] = useState<string[]>([]);
  const [pendingDelete, setPendingDelete] = useState(false);
  const [query, setQuery] = useState("");

  // Made here, not taken off the hook: the React Compiler reads a hook result reaching `ref` as a ref.
  const canvasRef = useRef<HTMLDivElement>(null);
  const marquee = useIconMarquee({
    surfaceRef: canvasRef,
    selection,
    onSelectionChange: setSelection,
  });

  const drop = useIconDrop({
    enabled: isAdmin,
    onFiles: (files) => void library.upload(files),
  });

  const { entries } = library;

  const trickle = useTrickleProgress(library.loading);
  const loadingPercent = preloaderPercent({
    loading: library.loading,
    trickle,
    progress: library.progress,
  });

  const shown = useMemo(
    () => entries.filter((entry) => matchesIcon(entry.icon, query)),
    [entries, query],
  );

  // Against the whole listing, not the search, so a selection can span searches.
  const chosen = useMemo(
    () => entries.filter((entry) => selection.includes(entry.icon.key)),
    [entries, selection],
  );

  const held = entries.filter((entry) => entry.icon.review === "held").length;
  const selectedHeld = chosen.filter(
    (entry) => entry.icon.review === "held",
  ).length;

  const download = () => {
    const taking = chosen.length > 0 ? chosen : shown;
    const plan = downloadPlanFor(
      iconFilesFor(taking, settings),
      archiveNameFor(settings),
    );
    if (plan) saveDownload(plan);
  };

  const publish = () => {
    void library.approve(
      chosen
        .filter((entry) => entry.icon.review === "held")
        .map((entry) => entry.icon.key),
    );
  };

  const remove = () => {
    setPendingDelete(false);
    const keys = chosen.map((entry) => entry.icon.key);
    setSelection([]);
    void library.remove(keys);
  };

  return (
    <main
      className={pageStyle}
      // Reserved in the server HTML; the body's effect lands a paint too late.
      {...{ [PANEL_RESERVED_ATTR]: open || undefined }}
    >
      <PlaygroundChrome />

      <div
        ref={canvasRef}
        data-icon-sheet
        className={canvasStyle}
        {...marquee.surfaceProps}
        {...drop.surfaceProps}
      >
        {library.preloading ? (
          <div className={emptyStyle}>
            <div className={preloaderStyle}>
              <ProgressBar value={loadingPercent} label="Loading icons" />
            </div>
          </div>
        ) : shown.length === 0 ? (
          <div className={emptyStyle}>
            <Typography tag="p" type="bodyLarge">
              {entries.length > 0
                ? `Nothing matches “${query.trim()}”.`
                : isAdmin
                  ? "Nothing here yet. Add icons from the sidebar."
                  : "There are no icons here yet."}
            </Typography>
          </div>
        ) : (
          <IconGrid
            entries={shown}
            settings={settings}
            selection={selection}
            onSelectionChange={setSelection}
            showsReview={isAdmin}
            consumeSweep={marquee.consumeSweep}
            sweeping={marquee.sweeping}
          />
        )}

        {marquee.band && <MarqueeBand rect={marquee.band} />}

        {drop.over && (
          <div className={dropOverlayStyle} data-icon-drop>
            <div className={dropFrameStyle}>
              <Typography tag="p" type="bodyLarge">
                Drop SVGs to add
              </Typography>
            </div>
          </div>
        )}
      </div>

      {/* Mounted even when nothing matches: the search box is the only way to undo the query. */}
      <div className={barScrimStyle} aria-hidden>
        <ScrimBlur towards="top" />
      </div>
      <div className={barStyle}>
        <div className={barLedgeSlotStyle}>
          <div className={barLedgeStyle}>
            <InfoIcon className={barLedgeIconStyle} aria-hidden />
            <span className={barHintTextStyle}>
              {"Hold "}
              <kbd className={barHintKeyStyle}>Shift</kbd>
              {" or drag to select multiple icons"}
            </span>
          </div>
        </div>
        <div className={barFieldStyle}>
          <SearchField
            value={query}
            onValueChange={setQuery}
            placeholder="Search icons…"
            ariaLabel="Search icons by name"
            action={
              !open && sheet ? (
                <Button
                  variant="icon"
                  aria-label="Icon properties"
                  onClick={() => setOpen(true)}
                >
                  <PropertiesPanel.DockIcon />
                </Button>
              ) : undefined
            }
          />
        </div>
      </div>

      {!open && !sheet && (
        <Button
          variant="icon"
          aria-label="Icon properties"
          className={triggerStyle}
          onClick={() => setOpen(true)}
        >
          <PropertiesPanel.DockIcon />
          <Button.Tooltip>
            <Tooltip.Text>Icon properties</Tooltip.Text>
          </Button.Tooltip>
        </Button>
      )}

      {open && (
        <IconsPanel
          settings={settings}
          onChange={setSettings}
          total={entries.length}
          shown={shown.length}
          held={held}
          selected={chosen.length}
          selectedHeld={selectedHeld}
          onDownload={download}
          isAdmin={isAdmin}
          busy={library.busy}
          problem={library.problem}
          onUpload={(files) => void library.upload(files)}
          locked={locked}
          onLockedChange={(next) => {
            setLocked(next);
            if (next) setSettings(iconSettingsLockedTo(settings, "size"));
          }}
          onPublish={publish}
          onDelete={() => setPendingDelete(true)}
          named={isAdmin ? chosen.map((entry) => entry.icon) : []}
          onRename={(edits) => void library.rename(edits)}
          onDismiss={() => setOpen(false)}
        />
      )}

      <ConfirmDialog
        open={pendingDelete}
        title={chosen.length === 1 ? "Delete Icon" : "Delete Icons"}
        message={
          chosen.length === 1
            ? `Delete ${chosen[0]?.icon.name}? This cannot be undone.`
            : `Delete ${chosen.length} icons? This cannot be undone.`
        }
        confirmLabel="Delete"
        confirmIcon={TrashIcon}
        onConfirm={remove}
        onClose={() => setPendingDelete(false)}
      />
    </main>
  );
}
