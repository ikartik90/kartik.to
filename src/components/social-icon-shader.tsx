"use client";

import { ShaderMount } from "@paper-design/shaders-react";
import {
  defaultObjectSizing,
  gemSmokeFragmentShader,
  getShaderColorFromString,
  GemSmokeShapes,
  ShaderFitOptions,
  type GemSmokeUniforms,
} from "@paper-design/shaders";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { headingInto, type PointerSample } from "@/utils/pointer-trajectory";
import {
  prepareGemSmokeMask,
  preparedGemSmokeMask,
} from "@/utils/gem-smoke-mask";
import { usePageLoaded } from "@/hooks/use-page-loaded";
import { css, cx } from "../../styled-system/css";

const BRAND_PINK = "#FF4D97";
const BRAND_ORANGE = "#FFAB6F";
const TRANSPARENT = "#00000000";

/** 20px or 16px, written on the slot below and nowhere else: the shader is sized from the slot. */
export type SocialIconSize = "md" | "sm";

const SHADER_MAX_PIXELS = 40 * 40;

// How far ahead of the cursor to look.
const APPROACH_HORIZON_MS = 300;

const WARM_IDLE_TIMEOUT_MS = 2000;

// Written into the uniforms, not <GemSmoke> props, which would re-process the pre-processed mask.
const FLUORESCENT = {
  innerDistortion: 0.5,
  outerDistortion: 0.8,
  outerGlow: 0,
  innerGlow: 1,
  offset: 0,
  angle: 0,
  size: 0.8,
  shape: GemSmokeShapes.diamond,
} as const;

/** What <GemSmoke> would build for these props, typed so a library rename is a type error. */
function gemSmokeUniforms(
  mask: HTMLImageElement,
  colors: string[],
): GemSmokeUniforms {
  return {
    u_colors: colors.map(getShaderColorFromString),
    u_colorsCount: colors.length,
    u_colorBack: getShaderColorFromString(TRANSPARENT),
    u_colorInner: getShaderColorFromString(TRANSPARENT),
    u_image: mask,
    u_innerDistortion: FLUORESCENT.innerDistortion,
    u_outerDistortion: FLUORESCENT.outerDistortion,
    u_outerGlow: FLUORESCENT.outerGlow,
    u_innerGlow: FLUORESCENT.innerGlow,
    u_offset: FLUORESCENT.offset,
    u_angle: FLUORESCENT.angle,
    u_size: FLUORESCENT.size,
    u_shape: FLUORESCENT.shape,
    u_isImage: true,
    u_fit: ShaderFitOptions.contain,
    u_scale: 1,
    u_rotation: defaultObjectSizing.rotation,
    u_offsetX: defaultObjectSizing.offsetX,
    u_offsetY: defaultObjectSizing.offsetY,
    u_originX: defaultObjectSizing.originX,
    u_originY: defaultObjectSizing.originY,
    u_worldWidth: defaultObjectSizing.worldWidth,
    u_worldHeight: defaultObjectSizing.worldHeight,
  };
}

function subscribeTheme(onStoreChange: () => void) {
  const observer = new MutationObserver(onStoreChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });
  return () => observer.disconnect();
}

function getTheme() {
  return document.documentElement.getAttribute("data-theme") === "dark"
    ? "dark"
    : "light";
}

function subscribeReducedMotion(onStoreChange: () => void) {
  if (typeof window.matchMedia !== "function") return () => undefined;
  const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  mediaQuery.addEventListener("change", onStoreChange);
  return () => mediaQuery.removeEventListener("change", onStoreChange);
}

function getReducedMotion() {
  return (
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/** Run `task` when the browser is idle — or `WARM_IDLE_TIMEOUT_MS` from now. */
function whenIdle(task: () => void): () => void {
  if (typeof requestIdleCallback === "function") {
    const handle = requestIdleCallback(() => task(), {
      timeout: WARM_IDLE_TIMEOUT_MS,
    });
    return () => cancelIdleCallback(handle);
  }
  const handle = setTimeout(task, 0);
  return () => clearTimeout(handle);
}

// One shader for the whole row, moved to the hovered icon: each instance is a WebGL context.
// Mounts ShaderMount directly, once its mask is prepared, since <GemSmoke> would redo the pre-pass.
interface StageContext {
  /** Register an icon slot; the stage parks on the first one registered. */
  register: (element: HTMLElement, maskSrc: string) => () => void;
  claim: (element: HTMLElement, maskSrc: string) => void;
  /** Ignored if another slot has since claimed. */
  release: (element: HTMLElement) => void;
}

const StageContext = createContext<StageContext | null>(null);

interface Placement {
  maskSrc: string;
  size: number;
  left: number;
  top: number;
}

const stageStyle = css({ position: "relative" });

const slotStyle = css({
  position: "relative",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
});

const slotSizeStyle = {
  md: css({ width: "token(spacing.xxl)", height: "token(spacing.xxl)" }),
  sm: css({ width: "token(spacing.xl)", height: "token(spacing.xl)" }),
} as const satisfies Record<SocialIconSize, string>;

const iconLayerStyle = css({
  position: "absolute",
  inset: 0,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  transitionProperty: "opacity",
  transitionDuration: "180ms",
  transitionTimingFunction: "ease-out",
});

const iconHiddenStyle = css({ opacity: 0 });

const shaderLayerStyle = css({
  position: "absolute",
  opacity: 0,
  transitionProperty: "opacity",
  transitionDuration: "180ms",
  transitionTimingFunction: "ease-out",
  pointerEvents: "none",
});

const shaderVisibleStyle = css({ opacity: 1, _starting: { opacity: 0 } });

export function SocialShaderStage({ children }: { children: ReactNode }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const slots = useRef<{ element: HTMLElement; maskSrc: string }[]>([]);
  const claimedBy = useRef<HTMLElement | null>(null);

  const theme = useSyncExternalStore(subscribeTheme, getTheme, () => "light");
  const reducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotion,
    () => false,
  );
  const enabled = !reducedMotion;

  const [warm, setWarm] = useState(false);
  const [showing, setShowing] = useState(false);
  const [masks, setMasks] = useState<Record<string, true>>({});
  // Kept after a hover ends, so leaving is a fade-out, not a mask swap.
  const [placement, setPlacement] = useState<Placement | null>(null);

  const placementFor = useCallback(
    (element: HTMLElement, maskSrc: string): Placement | null => {
      const stage = stageRef.current;
      if (!stage) return null;
      const slotBox = element.getBoundingClientRect();
      const stageBox = stage.getBoundingClientRect();
      const size = Math.round(slotBox.width);
      return {
        maskSrc,
        size,
        left: slotBox.left - stageBox.left + (slotBox.width - size) / 2,
        top: slotBox.top - stageBox.top + (slotBox.height - size) / 2,
      };
    },
    [],
  );

  const register = useCallback((element: HTMLElement, maskSrc: string) => {
    slots.current.push({ element, maskSrc });
    return () => {
      slots.current = slots.current.filter((slot) => slot.element !== element);
      if (claimedBy.current === element) claimedBy.current = null;
    };
  }, []);

  const claim = useCallback(
    (element: HTMLElement, maskSrc: string) => {
      claimedBy.current = element;
      const next = placementFor(element, maskSrc);
      if (next) {
        setPlacement((current) =>
          current &&
          current.maskSrc === next.maskSrc &&
          current.size === next.size &&
          current.left === next.left &&
          current.top === next.top
            ? current
            : next,
        );
      }
      setWarm(true);
      setShowing(true);
    },
    [placementFor],
  );

  const release = useCallback((element: HTMLElement) => {
    // The next icon's claim fires before this release, so only the current holder may let go.
    if (claimedBy.current !== element) return;
    claimedBy.current = null;
    setShowing(false);
  }, []);

  const pageLoaded = usePageLoaded();
  useEffect(() => {
    if (!enabled || warm || !pageLoaded) return;
    return whenIdle(() => setWarm(true));
  }, [enabled, warm, pageLoaded]);

  // Approach warm-up: start as soon as the cursor heads for the row.
  useEffect(() => {
    if (!enabled || warm) return;

    let previous: PointerSample | null = null;
    let box = stageRef.current?.getBoundingClientRect() ?? null;
    const remeasure = () => {
      box = stageRef.current?.getBoundingClientRect() ?? null;
    };

    const handleMove = (event: PointerEvent | MouseEvent) => {
      const sample = {
        x: event.clientX,
        y: event.clientY,
        t: performance.now(),
      };
      if (
        previous &&
        box &&
        headingInto(previous, sample, box, APPROACH_HORIZON_MS)
      ) {
        setWarm(true);
        return;
      }
      previous = sample;
    };

    window.addEventListener("pointermove", handleMove, { passive: true });
    window.addEventListener("scroll", remeasure, { passive: true });
    window.addEventListener("resize", remeasure, { passive: true });
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("scroll", remeasure);
      window.removeEventListener("resize", remeasure);
    };
  }, [enabled, warm]);

  useEffect(() => {
    if (!warm || placement) return;
    const first = slots.current[0];
    if (!first) return;
    const parked = placementFor(first.element, first.maskSrc);
    if (parked) setPlacement(parked);
  }, [warm, placement, placementFor]);

  // Serially, claimed mask first, so the page stays responsive through the pre-passes.
  useEffect(() => {
    if (!enabled || !warm) return;
    let cancelled = false;

    (async () => {
      const wanted = placement?.maskSrc;
      const order = [
        ...(wanted ? [wanted] : []),
        ...slots.current
          .map((slot) => slot.maskSrc)
          .filter((src) => src !== wanted),
      ];
      for (const src of order) {
        if (cancelled) return;
        if (preparedGemSmokeMask(src)) {
          setMasks((current) =>
            current[src] ? current : { ...current, [src]: true },
          );
          continue;
        }
        try {
          await prepareGemSmokeMask(src);
        } catch {
          continue;
        }
        if (cancelled) return;
        setMasks((current) => ({ ...current, [src]: true }));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, warm, placement?.maskSrc]);

  const colors =
    theme === "light"
      ? [BRAND_ORANGE, BRAND_PINK, "#ffffff"]
      : [BRAND_PINK, BRAND_ORANGE, "#ffffff"];

  // No prepared mask, no shader: without one it renders unmasked over the whole box.
  const mask =
    placement && masks[placement.maskSrc]
      ? preparedGemSmokeMask(placement.maskSrc)
      : null;

  // Memoised: ShaderMount re-uploads its textures whenever this object's identity changes.
  const uniforms = useMemo(
    () => (mask ? { ...gemSmokeUniforms(mask, colors) } : null),
    // `colors` derives from `theme` alone.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mask, theme],
  );

  // Stable, or every slot re-registers on each render.
  const stage = useMemo(
    () => ({ register, claim, release }),
    [register, claim, release],
  );

  return (
    <StageContext.Provider value={stage}>
      <div ref={stageRef} className={stageStyle} data-social-shader-stage>
        {children}
        {enabled && warm && placement && uniforms && (
          <ShaderMount
            aria-hidden
            data-social-icon-shader
            data-shader-active={showing ? "" : undefined}
            className={cx(shaderLayerStyle, showing && shaderVisibleStyle)}
            style={{ left: placement.left, top: placement.top }}
            fragmentShader={gemSmokeFragmentShader}
            mipmaps={["u_image"]}
            uniforms={uniforms}
            width={placement.size}
            height={placement.size}
            speed={showing ? 1 : 0}
            maxPixelCount={SHADER_MAX_PIXELS}
          />
        )}
      </div>
    </StageContext.Provider>
  );
}

/** One icon's slot: draws the icon and tells the stage when the shader belongs over it. */
export function SocialIconShader({
  maskSrc,
  active,
  size = "md",
  children,
}: {
  maskSrc: string;
  active: boolean;
  size?: SocialIconSize;
  children: ReactNode;
}) {
  const stage = useContext(StageContext);
  const slotRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const element = slotRef.current;
    if (!stage || !element) return;
    return stage.register(element, maskSrc);
  }, [stage, maskSrc]);

  useEffect(() => {
    const element = slotRef.current;
    if (!stage || !element) return;
    if (active) {
      stage.claim(element, maskSrc);
      return;
    }
    stage.release(element);
  }, [stage, active, maskSrc]);

  return (
    <span ref={slotRef} className={cx(slotStyle, slotSizeStyle[size])}>
      <span
        className={cx(iconLayerStyle, active && iconHiddenStyle)}
        aria-hidden
      >
        {children}
      </span>
    </span>
  );
}
