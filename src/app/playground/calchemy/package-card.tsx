"use client";

import { useEffect, useState } from "react";
import { css, cx } from "../../../../styled-system/css";
import { Button } from "@/components/ui/button";
import { Link } from "@/components/ui/link";
import LinkIcon from "@/assets/icons/link.svg";
import GotoIcon from "@/assets/icons/goto.svg";
import CopyIcon from "@/assets/icons/copy.svg";
import CheckIcon from "@/assets/icons/check.svg";

const DOCS_URL = "https://www.npmjs.com/package/@calchemy/date-core";
const INSTALL = "npm i @calchemy/date-core";
const COPIED_MS = 1500;

const cardStyle = css({
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  gap: "md",
  padding: "md",
  borderRadius: "md",
  backgroundColor: "bg.button.secondary.default",
  color: "text.body",
});

const rowStyle = css({
  paddingBlock: "xs",
});

const fillStyle = css({ width: "100%" });

const docsStyle = css({ justifyContent: "space-between" });

const docsLabelStyle = css({
  display: "flex",
  alignItems: "center",
  gap: "sm",
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
});

const installStyle = css({
  backgroundColor:
    "color-mix(in srgb, token(colors.text.body) 5%, transparent)",
});

const commandStyle = css({
  flex: "1 1 auto",
  minWidth: 0,
  textStyle: "code",
  textAlign: "start",
  whiteSpace: "nowrap",
});

const dividerStyle = css({
  alignSelf: "stretch",
  flexShrink: 0,
  width: 0,
  marginBlock: "calc(-1 * token(spacing.xs))",
  borderLeftWidth: "token(spacing.3xs)",
  borderLeftStyle: "solid",
  borderLeftColor: "border.divider",
});

export function PackageCard() {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), COPIED_MS);
    return () => clearTimeout(timer);
  }, [copied]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(INSTALL);
      setCopied(true);
    } catch {
      // Clipboard API unavailable — the command is still there to select.
    }
  }

  return (
    <div className={cardStyle}>
      <Link
        href={DOCS_URL}
        target="_blank"
        variant="icon"
        className={cx(rowStyle, fillStyle, docsStyle)}
      >
        <span className={docsLabelStyle}>
          <LinkIcon aria-hidden />
          Package documentation
        </span>
        <GotoIcon aria-hidden />
      </Link>
      <Button
        variant="icon"
        aria-label={copied ? "Copied install command" : "Copy install command"}
        className={cx(rowStyle, fillStyle, installStyle)}
        onClick={copy}
      >
        <code className={commandStyle}>{INSTALL}</code>
        <span className={dividerStyle} aria-hidden />
        {copied ? <CheckIcon aria-hidden /> : <CopyIcon aria-hidden />}
      </Button>
    </div>
  );
}
