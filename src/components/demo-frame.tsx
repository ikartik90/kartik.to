"use client";

import {
  forwardRef,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type CSSProperties,
  type ReactNode,
} from "react";
import { css, cx } from "../../styled-system/css";
import {
  demoFrame,
  demoFrameDemoArea,
  type DemoFrameDemoAreaVariantProps,
} from "../../styled-system/recipes";
import {
  DemoLogger,
  type DemoLoggerConfig,
} from "@/components/demo-logger";
import { DemoLoggerProvider } from "@/hooks/use-demo-logger";
import {
  getDemoFrameMinHeight,
  shouldOverrideDemoFrameAspectRatio,
  type DemoFrameAspectRatio,
} from "@/utils/demo-frame-sizing";

export type { DemoFrameAspectRatio, DemoLoggerConfig };

interface DemoFrameProps
  extends Omit<DemoFrameDemoAreaVariantProps, "logger">,
    ComponentPropsWithoutRef<"div"> {
  children: ReactNode;
  logger?: boolean | DemoLoggerConfig;
  /** When false, logger controls are inert. */
  interactive?: boolean;
  /** `"none"` drops the frame's outline. */
  chrome?: "none";
  /** Hands the demo the frame's area to fill instead of measuring it at its intrinsic size. */
  fill?: boolean;
}

function resolveLoggerConfig(
  logger: boolean | DemoLoggerConfig | undefined,
): { enabled: boolean; config: DemoLoggerConfig } {
  if (!logger) {
    return { enabled: false, config: {} };
  }

  if (logger === true) {
    return { enabled: true, config: {} };
  }

  return { enabled: true, config: logger };
}

const demoFrameDemoMeasureStyle = css({
  width: "fit-content",
  maxWidth: "token(spacing.full)",
  flexShrink: 0,
});

export const DemoFrame = forwardRef<HTMLDivElement, DemoFrameProps>(
  function DemoFrame(
    {
      children,
      aspectRatio = "2/1",
      logger,
      interactive = true,
      chrome,
      fill = false,
      className,
      style,
      ...props
    },
    ref,
  ) {
    const { enabled: loggerEnabled, config: loggerConfig } =
      resolveLoggerConfig(logger);
    const frameRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const measureRef = useRef<HTMLDivElement>(null);
    const [demoAreaStyle, setDemoAreaStyle] = useState<CSSProperties>({});
    const [loggerExpanded, setLoggerExpanded] = useState(false);
    const resolvedAspectRatio: DemoFrameAspectRatio = aspectRatio ?? "2/1";

    const mergedRef = useCallback(
      (node: HTMLDivElement | null) => {
        frameRef.current = node;

        if (typeof ref === "function") {
          ref(node);
        } else if (ref) {
          ref.current = node;
        }
      },
      [ref],
    );

    // Logger frames size from CSS. A filling demo must not be measured: its height feeds its own floor.
    useLayoutEffect(() => {
      if (loggerEnabled || fill) return;

      const frame = frameRef.current;
      const content = contentRef.current;
      if (!frame || !content) return;

      const updateDemoAreaSize = () => {
        const contentHeight =
          measureRef.current?.offsetHeight ?? content.offsetHeight;
        const frameWidth = frame.clientWidth;
        const minHeight = getDemoFrameMinHeight(contentHeight, false);
        const overrideAspectRatio = shouldOverrideDemoFrameAspectRatio(
          contentHeight,
          frameWidth,
          resolvedAspectRatio,
        );

        setDemoAreaStyle({
          minHeight,
          ...(overrideAspectRatio ? { aspectRatio: "auto" } : {}),
        });
      };

      const observer = new ResizeObserver(updateDemoAreaSize);
      if (measureRef.current) {
        observer.observe(measureRef.current);
      }
      observer.observe(frame);
      updateDemoAreaSize();

      return () => observer.disconnect();
    }, [resolvedAspectRatio, children, loggerEnabled, fill]);

    const frame = (
      <div
        ref={mergedRef}
        // The frame's controls reveal off this attribute.
        data-demo-frame=""
        className={cx(
          demoFrame({ logger: loggerEnabled ? true : undefined, chrome }),
          className,
        )}
        style={style}
        {...props}
      >
        <div
          ref={contentRef}
          className={demoFrameDemoArea({
            aspectRatio,
            logger: loggerEnabled ? true : undefined,
          })}
          style={demoAreaStyle}
        >
          {loggerEnabled || fill ? (
            children
          ) : (
            <div ref={measureRef} className={demoFrameDemoMeasureStyle}>
              {children}
            </div>
          )}
        </div>
        {loggerEnabled ? (
          interactive ? (
            <DemoLogger
              expanded={loggerExpanded}
              onExpandedChange={setLoggerExpanded}
              {...loggerConfig}
            />
          ) : (
            <div inert>
              <DemoLogger
                expanded={loggerExpanded}
                onExpandedChange={setLoggerExpanded}
                {...loggerConfig}
              />
            </div>
          )
        ) : null}
      </div>
    );

    if (!loggerEnabled) {
      return frame;
    }

    return <DemoLoggerProvider>{frame}</DemoLoggerProvider>;
  },
);
