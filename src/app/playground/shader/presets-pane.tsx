"use client";

import { useEffect, useRef, useState } from "react";
import { css } from "../../../../styled-system/css";
import { menuIcon } from "../../../../styled-system/recipes";
import {
  createShaderPreset,
  getShaderPresets,
} from "@/app/actions/shader-preset";
import { UnsavedDot } from "@/components/unsaved-dot";
import { useIsAdmin } from "@/hooks/use-is-admin";
import {
  NEW_SHADER_PRESET_KEY,
  unsavedShaderPresetKeys,
  useShaderPresetDraftStore,
} from "@/store/shader-preset-draft";
import { shaderPresetSwatch } from "@/utils/shader-preset-swatch";
import { paletteFor } from "@/domain/shader-preset";
import { useThemeToggle } from "@/hooks/use-theme-toggle";
import type { ShaderPreset, ShaderPresetContent } from "@/domain/shader-preset";
import {
  ShaderPresetThumbnails,
  thumbnailKey,
  thumbnailSnapshot,
} from "./shader-preset-thumbnails";
import AddIcon from "@/assets/icons/add.svg";

type Preset = ShaderPreset & ShaderPresetContent;

// Absolute on the canvas, not fixed: a viewport-fixed pane would centre on a width including the rail.
const paneStyle = css({
  position: "absolute",
  insetBlockEnd: "token(spacing.sm)",
  insetInline: 0,
  marginInline: "auto",
  zIndex: 1,

  width: "max-content",
  maxWidth:
    "min(token(sizes.articleShowcase), calc(token(spacing.full) - 2 * token(spacing.xxl)))",

  // The marks hang in the scroller's padding: a scroll container clips outside its padding box.
  paddingBlockStart: "xl",
  overflowX: "auto",
  // A swipe off the end must not become a back gesture away from unsaved work.
  overscrollBehaviorInline: "contain",

  // Hidden, never unmounted, while it waits: its library read tells the page the preset has settled.
  "--entrance-from": "calc(100% + token(spacing.sm))",
  visibility: "hidden",
  "[data-entered] &": {
    visibility: "visible",
    animation: "playgroundChromeIn 150ms ease-out 50ms backwards",
  },
});

const surfaceStyle = css({
  display: "flex",
  alignItems: "flex-start",
  gap: "md",
  padding: "lg",
  width: "max-content",

  borderWidth: "token(spacing.3xs)",
  borderStyle: "solid",
  borderColor: "border.divider",
  borderRadius: "xxl",
  backgroundColor: "bg.surface",
  "--colors-field-bg-default": "var(--colors-field-bg-default-on-surface)",
});

const tileStyle = css({
  flexShrink: 0,
  width: "token(spacing.5xl)",
  height: "token(spacing.5xl)",
  borderRadius: "md",
  borderWidth: "token(spacing.3xs)",
  borderStyle: "solid",
  borderColor: "border.divider",
  overflow: "hidden",
  cursor: "pointer",
  focusVisibleRing: "outside",
  "&[aria-current='true']": {
    cursor: "default",
    outlineWidth: "token(spacing.xs)",
    outlineStyle: "solid",
    outlineColor: "border.focusRing",
    outlineOffset: "token(spacing.xs)",
  },
});

const addTileStyle = css({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "text.body",
  backgroundColor: "bg.button.secondary.default",
  _hover: { backgroundColor: "bg.button.secondary.hover" },
  _disabled: { cursor: "progress", opacity: 0.5 },
});

// The mark is a sibling, not a child: the tile clips its own box.
const tileSlotStyle = css({ position: "relative", display: "flex" });

const tileMarkStyle = css({
  insetBlockEnd: "calc(token(spacing.full) + token(spacing.xxl))",
  "--unsaved-dot-size": "4px",
});

const addIconStyle = menuIcon();

function presetName(preset: Preset): string {
  return (
    preset.title?.trim() || `Untitled ${preset.untitledIndex ?? ""}`.trim()
  );
}

/** Loads a preset into the draft and updates the URL via `replaceState`: a navigation would remount the playground. */
function adoptPreset(preset: Preset, committed = false) {
  const draft = useShaderPresetDraftStore.getState();
  // A just-written preset is committed, not loaded, so the draft is not set aside as unsaved.
  (committed ? draft.commit : draft.load)({
    id: preset.id,
    title: preset.title ?? null,
    shaderId: preset.shaderId,
    settings: preset.settings,
    publishedAt: preset.publishedAt,
  });
  window.history.replaceState(null, "", `/playground/shader/${preset.id}`);
}

export interface PresetsPaneProps {
  /** Fired once the draft holds its final preset, not when the fetch returns. */
  onSettled?: () => void;
}

export function PresetsPane({ onSettled }: PresetsPaneProps = {}) {
  const shaderPresetId = useShaderPresetDraftStore(
    (draft) => draft.shaderPresetId,
  );
  const isDirty = useShaderPresetDraftStore((draft) => draft.isDirty);
  const buffers = useShaderPresetDraftStore((draft) => draft.buffers);
  const openNewDraft = useShaderPresetDraftStore((draft) => draft.openNewDraft);
  const { isDark } = useThemeToggle();
  const tileTheme = isDark ? "dark" : "light";
  const isAdmin = useIsAdmin();
  const unsaved = new Set(
    isAdmin
      ? unsavedShaderPresetKeys({ buffers, isDirty, shaderPresetId })
      : [],
  );

  const [presets, setPresets] = useState<Preset[]>([]);
  /** Whether the library has come back — read or failed, either is an answer. */
  const [libraryRead, setLibraryRead] = useState(false);
  const [thumbnails, setThumbnails] =
    useState<Record<string, string>>(thumbnailSnapshot);
  const [saving, setSaving] = useState(false);
  /** Once per mount: re-running would move a visitor off the preset they chose. */
  const opened = useRef(false);
  /** Whether the page has been told the draft is final. Also once per mount. */
  const settled = useRef(false);

  // Commits counted during render: keyed on `isDirty`, the re-read would cancel itself on every edit.
  const [tracked, setTracked] = useState({ dirty: false, commits: 0 });
  if (tracked.dirty !== isDirty) {
    setTracked({
      dirty: isDirty,
      commits: tracked.commits + (tracked.dirty && !isDirty ? 1 : 0),
    });
  }

  useEffect(() => {
    let live = true;
    getShaderPresets()
      .then((rows) => {
        if (live) setPresets(rows);
      })
      .catch(() => {})
      .finally(() => {
        if (live) setLibraryRead(true);
      });
    return () => {
      live = false;
    };
  }, [shaderPresetId, tracked.commits]);

  /** A visitor opens on the newest published preset, unless the draft already holds one (the `[id]` route). */
  useEffect(() => {
    if (isAdmin || opened.current || presets.length === 0) return;
    const draft = useShaderPresetDraftStore.getState();
    if (draft.shaderPresetId !== null || draft.isDirty) return;
    opened.current = true;
    adoptPreset(presets[0]);
  }, [isAdmin, presets]);

  /** Must stay after the adoption effect: effects run in declaration order, so the draft is final by now. */
  useEffect(() => {
    if (!libraryRead || settled.current) return;
    settled.current = true;
    onSettled?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [libraryRead]);

  /** Always creates a new preset (⌘S updates in place), then adopts what was stored. */
  async function addPreset() {
    if (saving) return;
    setSaving(true);
    try {
      const { title, shaderId, settings } =
        useShaderPresetDraftStore.getState();
      const saved = await createShaderPreset({ title, shaderId, settings });

      // What was stored, not what was sent: the schema normalises on the way in.
      adoptPreset(saved as Preset, true);
    } catch (err) {
      console.error("Failed to save the preset:", err);
    } finally {
      setSaving(false);
    }
  }

  function openPreset(preset: Preset) {
    if (preset.id === shaderPresetId) return;
    adoptPreset(preset);
  }

  function openNew() {
    if (shaderPresetId === null) return;
    openNewDraft();
    window.history.replaceState(null, "", "/playground/shader");
  }

  if (!isAdmin && presets.length === 0) return null;

  return (
    <>
      {/* The page reserves the strip's band off `data-presets`. */}
      <div className={paneStyle} data-presets>
        <div className={surfaceStyle} role="group" aria-label="Presets">
          {isAdmin && (
            <button
              type="button"
              className={`${tileStyle} ${addTileStyle}`}
              aria-label="New preset"
              disabled={saving}
              onClick={() => void addPreset()}
            >
              <AddIcon className={addIconStyle} />
            </button>
          )}

          {unsaved.has(NEW_SHADER_PRESET_KEY) && (
            <div className={tileSlotStyle}>
              <button
                type="button"
                className={tileStyle}
                aria-label="Unsaved draft"
                aria-current={shaderPresetId === null ? "true" : undefined}
                style={{
                  background: shaderPresetSwatch(
                    paletteFor(
                      (buffers[NEW_SHADER_PRESET_KEY]?.settings ??
                        useShaderPresetDraftStore.getState()
                          .settings) as Preset["settings"],
                      tileTheme,
                    ),
                  ),
                }}
                onClick={openNew}
              />
              <UnsavedDot className={tileMarkStyle} />
            </div>
          )}

          {presets.map((preset) => {
            const picture = thumbnails[thumbnailKey(preset, tileTheme)];
            return (
              <div className={tileSlotStyle} key={preset.id}>
                <button
                  type="button"
                  className={tileStyle}
                  aria-label={presetName(preset)}
                  aria-current={
                    preset.id === shaderPresetId ? "true" : undefined
                  }
                  style={
                    picture
                      ? {
                          backgroundImage: `url(${picture})`,
                          backgroundSize: "cover",
                        }
                      : {
                          background: shaderPresetSwatch(
                            paletteFor(preset.settings, tileTheme),
                          ),
                        }
                  }
                  onClick={() => openPreset(preset)}
                />
                {unsaved.has(preset.id) && (
                  <UnsavedDot className={tileMarkStyle} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      <ShaderPresetThumbnails
        presets={presets}
        theme={tileTheme}
        onCaptured={(key, url) =>
          setThumbnails((was) => ({ ...was, [key]: url }))
        }
      />
    </>
  );
}
