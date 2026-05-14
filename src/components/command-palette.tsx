"use client";

import { useEffect, useRef, useState } from "react";
import { Command } from "cmdk";
import { css } from "../../styled-system/css";
import { authClient } from "@/lib/auth/client";
import { useThemeStore } from "@/store/theme";
import { Dialog } from "@/components/ui/dialog";
import SearchIcon from "@/assets/icons/search.svg";
import DarkIcon from "@/assets/icons/dark.svg";
import LightIcon from "@/assets/icons/light.svg";
import EditIcon from "@/assets/icons/edit.svg";
import MetadataIcon from "@/assets/icons/metadata.svg";
import WriteIcon from "@/assets/icons/write.svg";
import WorkIcon from "@/assets/icons/work.svg";
import PageIcon from "@/assets/icons/page.svg";

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const panelStyle = css({
  backgroundColor: "bg.surface",
  borderRadius: "md",
  overflow: "hidden",
  width: "min(480px, calc(100vw - token(spacing.xl) * 2))",
  display: "flex",
  flexDirection: "column",
});

const inputRowStyle = css({
  display: "flex",
  alignItems: "center",
  gap: "md",
  height: "token(spacing.4xl)",
  paddingInline: "lg",
  borderBottomWidth: "token(spacing.3xs)",
  borderBottomStyle: "solid",
  borderColor: "border.divider",
  flexShrink: 0,
  color: "text.commandItem",
});

const inputStyle = css({
  flex: "1 0 0",
  background: "none",
  border: "none",
  outline: "none",
  textStyle: "commandItem",
  color: "text.commandItem",
  _placeholder: {
    color: "text.commandItem/25",
  },
});

const iconStyle = css({ flexShrink: 0 });

const hotkeyHintStyle = css({
  display: "flex",
  alignItems: "center",
  gap: "sm",
  flexShrink: 0,
});

const hotkeyBadgeStyle = css({
  display: "flex",
  alignItems: "center",
  height: "xxl",
  paddingInline: "sm",
  borderRadius: "sm",
  borderWidth: "token(spacing.3xs)",
  borderStyle: "solid",
  borderColor: "border.divider",
  backgroundColor: "border.divider",
});

const hotkeyKeyStyle = css({
  textStyle: "commandLabel",
  color: "text.commandItem",
  whiteSpace: "nowrap",
});

const hotkeyLabelStyle = css({
  textStyle: "commandLabel",
  color: "text.commandItem/50",
  whiteSpace: "nowrap",
});

const listStyle = css({
  display: "flex",
  flexDirection: "column",
  gap: "sm",
  paddingBlock: "md",
  overflowY: "auto",
});

const groupStyle = css({
  display: "flex",
  flexDirection: "column",
  paddingInline: "sm",
});

const groupHeadingStyle = css({
  display: "flex",
  alignItems: "center",
  height: "24px",
  paddingInline: "md",
  textStyle: "commandLabel",
  color: "text.commandItem/50",
});

const itemStyle = css({
  display: "flex",
  alignItems: "center",
  gap: "md",
  height: "token(spacing.3xl)",
  paddingInline: "md",
  borderRadius: "sm",
  cursor: "default",
  textStyle: "commandItem",
  color: "text.commandItem",
  "&[data-selected='true']": {
    backgroundColor: "border.divider",
  },
});

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CommandPalette() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  // Incrementing key forces Command to remount on each open, clearing search
  const [openKey, setOpenKey] = useState(0);

  const { data: session } = authClient.useSession();
  const isAdmin = !!session?.user;

  const { mode, setMode } = useThemeStore();
  // Defer until after mount so SSR and initial client render both see false,
  // preventing a hydration mismatch with the Zustand-persisted mode.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const isDark =
    mounted &&
    (mode === "dark" ||
      (mode === "system" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches));

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.metaKey && e.key === "k") {
        e.preventDefault();
        dialogRef.current?.showModal();
        setOpenKey((k) => k + 1);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <Dialog
      ref={dialogRef}
      align="top-center"
      aria-label="Command palette"
      className={panelStyle}
    >
      <Command key={openKey} className={css({ display: "contents" })}>
        {/* Input row */}
        <div className={inputRowStyle}>
          <SearchIcon width={20} height={20} className={iconStyle} />
          <Command.Input
            autoFocus
            placeholder="Search…"
            className={inputStyle}
          />
          <div className={hotkeyHintStyle}>
            <div className={hotkeyBadgeStyle}>
              <span className={hotkeyKeyStyle}>Esc</span>
            </div>
            <span className={hotkeyLabelStyle}>to exit</span>
          </div>
        </div>

        {/* Results */}
        <Command.List className={listStyle}>
          {/* Settings — always visible */}
          <Command.Group className={groupStyle}>
            <div className={groupHeadingStyle}>Settings</div>
            <Command.Item
              className={itemStyle}
              onSelect={() => setMode(isDark ? "light" : "dark")}
            >
              {isDark ? (
                <LightIcon width={20} height={20} className={iconStyle} />
              ) : (
                <DarkIcon width={20} height={20} className={iconStyle} />
              )}
              {isDark ? "Switch to light theme" : "Switch to dark theme"}
            </Command.Item>
          </Command.Group>

          {/* Admin-only groups */}
          {isAdmin && (
            <>
              <Command.Group className={groupStyle}>
                <div className={groupHeadingStyle}>This Page</div>
                <Command.Item
                  className={itemStyle}
                  onSelect={() => console.log("edit page")}
                >
                  <EditIcon width={20} height={20} className={iconStyle} />
                  Edit page
                </Command.Item>
                <Command.Item
                  className={itemStyle}
                  onSelect={() => console.log("edit metadata")}
                >
                  <MetadataIcon width={20} height={20} className={iconStyle} />
                  Edit metadata
                </Command.Item>
              </Command.Group>

              <Command.Group className={groupStyle}>
                <div className={groupHeadingStyle}>Publish</div>
                <Command.Item
                  className={itemStyle}
                  onSelect={() => console.log("new blog article")}
                >
                  <WriteIcon width={20} height={20} className={iconStyle} />
                  New blog article…
                </Command.Item>
                <Command.Item
                  className={itemStyle}
                  onSelect={() => console.log("new work article")}
                >
                  <WorkIcon width={20} height={20} className={iconStyle} />
                  New work article…
                </Command.Item>
                <Command.Item
                  className={itemStyle}
                  onSelect={() => console.log("new page")}
                >
                  <PageIcon width={20} height={20} className={iconStyle} />
                  New page…
                </Command.Item>
              </Command.Group>
            </>
          )}
        </Command.List>
      </Command>
    </Dialog>
  );
}
