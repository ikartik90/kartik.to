"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import { css, cx } from "../../styled-system/css";
import {
  demoLoggerBody,
  demoLoggerHeader,
  demoLoggerLine,
  demoLoggerPanel,
  demoLoggerSection,
  menuIcon,
} from "../../styled-system/recipes";
import { Button } from "@/components/ui/button";
import { HighlightedCode } from "@/components/highlighted-code";
import {
  useDemoLoggerEntries,
  type DemoLoggerLevel,
} from "@/hooks/use-demo-logger";
import { splitLoggerJsonMessage } from "@/utils/syntax-highlight";
import ConsoleIcon from "@/assets/icons/console.svg";
import CollapseIcon from "@/assets/icons/collapse.svg";
import ExpandIcon from "@/assets/icons/expand.svg";

export interface DemoLoggerConfig {
  emptyMessage?: string;
  emptyHint?: string;
  collapseLabel?: string;
  expandLabel?: string;
}

export interface DemoLoggerProps extends DemoLoggerConfig {
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
}

const DEFAULT_EMPTY_MESSAGE = "No output logs available";
const DEFAULT_COLLAPSE_LABEL = "Collapse output logs";
const DEFAULT_EXPAND_LABEL = "Expand output logs";

const levelVariants: Record<DemoLoggerLevel, "log" | "info" | "warn" | "error"> =
  {
    log: "log",
    info: "info",
    warn: "warn",
    error: "error",
  };

const iconStyle = menuIcon();

const consoleIconStyle = cx(
  iconStyle,
  css({ color: "text.body" }),
);

const headerLabelStyle = css({
  flex: "1 1 auto",
  minWidth: 0,
  textStyle: "bodySmall",
  color: "text.body",
  margin: 0,
});

const emptyStateStyle = css({
  flex: "1 1 auto",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: "md",
  minHeight: 0,
});

const illustrationStyle = css({
  width: "125px",
  height: "100px",
  position: "relative",
  flexShrink: 0,
});

const illustrationImageStyle = css({
  objectFit: "contain",
  outline: "[none]",
  outlineWidth: "0",
});

/** Dark UI uses the light-themed illustration asset. */
const illustrationForDarkUiStyle = css({
  display: "none",
  _dark: { display: "block" },
});

/** Light UI uses the dark-themed illustration asset. */
const illustrationForLightUiStyle = css({
  display: "block",
  _dark: { display: "none" },
});

const emptyMessageStyle = css({
  textStyle: "bodySmall",
  color: "text.body",
  margin: 0,
  textAlign: "center",
});

const emptyHintStyle = css({
  textStyle: "caption",
  color: "text.body/50",
  lineHeight: "1.25rem",
  margin: 0,
  textAlign: "center",
});

export function DemoLogger({
  expanded,
  onExpandedChange,
  emptyMessage = DEFAULT_EMPTY_MESSAGE,
  emptyHint,
  collapseLabel = DEFAULT_COLLAPSE_LABEL,
  expandLabel = DEFAULT_EXPAND_LABEL,
}: DemoLoggerProps) {
  const entries = useDemoLoggerEntries();
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!expanded || entries.length === 0) return;

    const body = bodyRef.current;
    if (!body) return;

    body.scrollTop = body.scrollHeight;
  }, [entries, expanded]);

  return (
    <div className={demoLoggerSection()}>
      <div className={demoLoggerPanel({ expanded })}>
        <div className={demoLoggerHeader({ expanded })}>
          <ConsoleIcon className={consoleIconStyle} aria-hidden />
          <p className={headerLabelStyle}>Output</p>
          <Button
            type="button"
            variant="icon"
            aria-label={expanded ? collapseLabel : expandLabel}
            aria-expanded={expanded}
            onClick={() => onExpandedChange(!expanded)}
          >
            {expanded ? (
              <CollapseIcon className={iconStyle} aria-hidden />
            ) : (
              <ExpandIcon className={iconStyle} aria-hidden />
            )}
          </Button>
        </div>
        <div
          ref={bodyRef}
          className={demoLoggerBody({ expanded })}
          {...(expanded
            ? { role: "log", "aria-live": "polite" as const }
            : { "aria-hidden": true })}
        >
          {entries.length === 0 ? (
            <div className={emptyStateStyle}>
              <div className={illustrationStyle}>
                <Image
                  src="/assets/terminal-dark.png"
                  alt=""
                  fill
                  sizes="125px"
                  className={cx(
                    illustrationForLightUiStyle,
                    illustrationImageStyle,
                  )}
                />
                <Image
                  src="/assets/terminal-light.png"
                  alt=""
                  fill
                  sizes="125px"
                  className={cx(
                    illustrationForDarkUiStyle,
                    illustrationImageStyle,
                  )}
                />
              </div>
              <p className={emptyMessageStyle}>{emptyMessage}</p>
              {emptyHint ? (
                <p className={emptyHintStyle}>{emptyHint}</p>
              ) : null}
            </div>
          ) : (
            entries.map((entry) => {
              const { prefix, json } = splitLoggerJsonMessage(entry.message);

              return (
                <p
                  key={entry.id}
                  className={cx(
                    demoLoggerLine({ level: levelVariants[entry.level] }),
                  )}
                >
                  {json ? (
                    <>
                      {prefix}
                      {"\n"}
                      <HighlightedCode code={json} language="json" />
                    </>
                  ) : (
                    prefix
                  )}
                </p>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
