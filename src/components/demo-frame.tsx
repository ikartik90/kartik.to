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
  extends DemoFrameDemoAreaVariantProps,
    ComponentPropsWithoutRef<"div"> {
  children: ReactNode;
  logger?: boolean | DemoLoggerConfig;
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
    const [loggerExpanded, setLoggerExpanded] = useState(true);
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
        className={cx(
          demoFrame({ logger: loggerEnabled ? true : undefined }),
          className,
        )}
        style={style}
        {...props}
      >
        <div
          ref={contentRef}
          className={demoFrameDemoArea({ aspectRatio })}
          style={demoAreaStyle}
        >
          <div ref={measureRef} className={demoFrameDemoMeasure()}>
            {children}
          </div>
        </div>
        {loggerEnabled ? (
          <DemoLogger
            expanded={loggerExpanded}
            onExpandedChange={setLoggerExpanded}
            {...loggerConfig}
          />
        ) : null}
      </div>
    );

    if (!loggerEnabled) {
      return frame;
    }

    return <DemoLoggerProvider>{frame}</DemoLoggerProvider>;
  },
);
