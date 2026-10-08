import { useEffect, useRef, useState, type RefObject } from "react";
import { openCard, projectPath } from "./data";
import type { SheetHandle } from "./project-sheet";

const sheetAt = (pathname: string) => openCard(/^\/projects\/([^/]+)\/?$/.exec(pathname)?.[1] ?? "")?.id ?? null;

/**
 * The open sheet, kept in the address as `/projects/<id>`. Opening one adds an entry that closing takes back off, so
 * Back closes it and Forward opens it again; another card's sheet in its place replaces the entry. A sheet opened at
 * its own address leaves the homepage's in its place as it closes.
 */
export function useSheetAddress(initial: string | undefined, sheet: RefObject<SheetHandle | null>) {
  const [openId, setOpenId] = useState(initial ?? null);
  // For the history's events, which can come before a render.
  const shown = useRef(openId);
  // The entry behind this one is the page without the sheet.
  const added = useRef(false);

  const show = (id: string | null) => {
    shown.current = id;
    setOpenId(id);
  };

  useEffect(() => {
    // A link from before sheets had addresses of their own.
    const legacy = new URLSearchParams(window.location.search).get("sheet");
    if (initial || !legacy || !openCard(legacy)) return;
    window.history.replaceState(null, "", projectPath(legacy));
    shown.current = legacy;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpenId(legacy);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onPopState = () => {
      const id = sheetAt(window.location.pathname);
      if (shown.current && !id) {
        added.current = false;
        sheet.current?.close();
      } else if (!shown.current && id) {
        added.current = true;
        shown.current = id;
        setOpenId(id);
      }
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [sheet]);

  return {
    openId,
    open: (id: string) => {
      window.history.pushState(null, "", projectPath(id));
      added.current = true;
      show(id);
    },
    switchTo: (id: string) => {
      window.history.replaceState(null, "", projectPath(id));
      show(id);
    },
    /** After the sheet has closed, by any means. */
    closed: () => {
      show(null);
      if (sheetAt(window.location.pathname)) {
        if (added.current) window.history.back();
        else window.history.replaceState(null, "", "/");
      }
      added.current = false;
    },
  };
}
