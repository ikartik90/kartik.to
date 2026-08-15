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
import { cx } from "../../styled-system/css";
import {
  demoFrame,
  demoFrameDemoArea,
  demoFrameDemoMeasure,
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
  /** When false, logger controls are inert (e.g. article edit preview). */
  interactive?: boolean;
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

export const DemoFrame = forwardRef<HTMLDivElement, DemoFrameProps>(
  function DemoFrame(
    {
      children,
      aspectRatio = "sm",
      logger,
      interactive = true,
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
    const resolvedAspectRatio = (aspectRatio ?? "sm") as DemoFrameAspectRatio;

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

    // Logger frames reserve their aspect-ratio height as a CSS floor (cqw
    // compound variant on `demoFrameDemoArea`), so the frame is full-height from
    // SSR with no client-measured jump — no JS sizing needed here.

    useLayoutEffect(() => {
      if (loggerEnabled) return;

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
    }, [resolvedAspectRatio, children, loggerEnabled]);

    const frame = (
      <div
        ref={mergedRef}
        // The hook the frame's own controls reveal themselves off — they are
        // absolute against this box, and up only while the visitor is in it.
        data-demo-frame=""
        className={cx(
          demoFrame({ logger: loggerEnabled ? true : undefined }),
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
          {loggerEnabled ? (
            children
          ) : (
            <div ref={measureRef} className={demoFrameDemoMeasure()}>
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
