import { useEffect, useRef, useState, type RefObject } from "react";
import { flushSync } from "react-dom";
import { PROJECT_CARDS, projectPath } from "@/data/project-cards";

const projectAt = (pathname: string, base: string) =>
  PROJECT_CARDS.find((card) => projectPath(card.id, base) === pathname.replace(/\/$/, ""))?.id ?? null;

/**
 * The project open in the overlay, kept in the address as `<base>/projects/<id>`. Opening one adds an entry that
 * closing takes back off, so Back closes it and Forward opens it again; another project in its place replaces the
 * entry. A project opened at its own address leaves the homepage's in its place as it closes.
 */
export function useProjectAddress(
  initial: string | undefined,
  overlay: RefObject<{ close: () => void } | null>,
  base = "",
) {
  const [openId, setOpenId] = useState(initial ?? null);
  // For the history's events, which can come before a render.
  const shown = useRef(openId);
  // The entry behind this one is the page without the overlay.
  const added = useRef(false);
  // It is closing because the history took its address off, and then follows the address wherever that is by then.
  const leaving = useRef(false);

  const show = (id: string | null) => {
    shown.current = id;
    setOpenId(id);
  };

  useEffect(() => {
    const onPopState = () => {
      const id = projectAt(window.location.pathname, base);
      if (shown.current && !id) {
        added.current = false;
        leaving.current = true;
        overlay.current?.close();
      } else if (!shown.current && id) {
        added.current = true;
        shown.current = id;
        setOpenId(id);
      }
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [overlay, base]);

  return {
    openId,
    open: (id: string) => {
      window.history.pushState(null, "", projectPath(id, base));
      added.current = true;
      show(id);
    },
    switchTo: (id: string) => {
      if (projectAt(window.location.pathname, base) === id) return;
      window.history.replaceState(null, "", projectPath(id, base));
    },
    /** After the overlay has closed, by any means. */
    closed: () => {
      if (leaving.current) {
        leaving.current = false;
        const id = projectAt(window.location.pathname, base);
        if (!id) return show(null);
        // Forward again as it closed. The overlay has to see itself closed, or it won't open again.
        flushSync(() => show(null));
        added.current = true;
        return show(id);
      }
      show(null);
      if (projectAt(window.location.pathname, base)) {
        if (added.current) window.history.back();
        else window.history.replaceState(null, "", base || "/");
      }
      added.current = false;
    },
  };
}
