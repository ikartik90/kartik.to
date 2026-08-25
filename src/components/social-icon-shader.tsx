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

/** The icon's drawn size, and so the shader's. */
const ICON_PX = 20;

// Cap the render buffer so retina screens don't quadruple the fragment work on
// a 20px icon. 40×40 ≈ 2×; smoke is soft, so it reads fine well below native DPR.
const SHADER_MAX_PIXELS = 40 * 40;

// How far ahead of the cursor to look. At an ordinary mouse speed this is a
// few hundred pixels of warning — enough to build the context and compile
// before the hand arrives, and short enough that crossing the page on other
// business doesn't trip it.
const APPROACH_HORIZON_MS = 300;

// The background warm-up runs when the browser has a moment, and no later than
// this. Late is fine: the reader who never touches the icons pays nothing they
// notice, and ⌘K is answered long before it runs.
const WARM_IDLE_TIMEOUT_MS = 2000;

// The tuning, unchanged — it is now written straight into the uniforms rather
// than passed as `<GemSmoke>` props, because the mask arrives pre-processed
// (see gem-smoke-mask.ts) and that component would insist on processing it
// again. `shape` is GemSmoke's own default, kept so the look does not move.
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

/**
 * What `<GemSmoke>` would have built for these props. Typed as the library's
 * own `GemSmokeUniforms`, so a rename in a future version is a type error here
 * rather than a shader that quietly renders nothing. Spread on return, because
 * an interface has no index signature to satisfy the mount's `Record`-shaped
 * prop while the builder itself stays typed.
 */
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

// ---------------------------------------------------------------------------
// The stage
//
// ONE shader for the whole row, moved to whichever icon is hovered — not one
// per icon. Each instance is its own WebGL context, and each mask costs a
// Poisson pre-pass; four of them warming together blocked the main thread for
// ~2s on the homepage, which is the window in which ⌘K is first pressed.
//
// The two go together. A single instance is only viable because the masks are
// prepared ahead of the hover (gem-smoke-mask.ts) and handed over finished:
// `<GemSmoke>` would re-run that pre-pass on every icon change, stalling the
// hover and — until it finished — drawing the smoke over the icon's whole box
// with nothing masking it. So this mounts `ShaderMount` directly, and only
// once the mask it needs is ready.
//
// Nothing here is a fallback: the hover effect is the same effect, the same
// shader and the same warm-before-you-arrive behaviour. What changed is how
// many copies of it exist, and when the mask work happens.
// ---------------------------------------------------------------------------

interface StageContext {
  /** Register an icon slot; the stage parks on the first one registered. */
  register: (element: HTMLElement, maskSrc: string) => () => void;
  /** This slot is hovered — bring the shader here. */
  claim: (element: HTMLElement, maskSrc: string) => void;
  /** This slot's hover ended. Ignored if another slot has since claimed. */
  release: (element: HTMLElement) => void;
}

const StageContext = createContext<StageContext | null>(null);

interface Placement {
  maskSrc: string;
  left: number;
  top: number;
}

const stageStyle = css({ position: "relative" });

const slotStyle = css({
  position: "relative",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: "token(spacing.xxl)",
  height: "token(spacing.xxl)",
});

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

// Absolutely placed against the stage rather than the slot, because there is
// one of it and four of them. `left`/`top` come from the claimed slot's box.
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
  // Which masks have been through the pre-pass. The shader is never mounted
  // without one: an unprepared GemSmoke renders unmasked over its whole box,
  // which is the flash this replaces.
  const [masks, setMasks] = useState<Record<string, true>>({});
  // Where the shader sits. Kept after a hover ends so leaving an icon is a
  // fade-out, not a mask swap back to somewhere else.
  const [placement, setPlacement] = useState<Placement | null>(null);

  const placementFor = useCallback(
    (element: HTMLElement, maskSrc: string): Placement | null => {
      const stage = stageRef.current;
      if (!stage) return null;
      const slotBox = element.getBoundingClientRect();
      const stageBox = stage.getBoundingClientRect();
      return {
        maskSrc,
        left: slotBox.left - stageBox.left + (slotBox.width - ICON_PX) / 2,
        top: slotBox.top - stageBox.top + (slotBox.height - ICON_PX) / 2,
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
      // Same slot, same box: keep the object, so re-hovering the icon the
      // shader is already parked on is not a re-render and not a mask swap.
      if (next) {
        setPlacement((current) =>
          current &&
          current.maskSrc === next.maskSrc &&
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
    // Moving from one icon to the next fires the new claim before the old
    // release; only the slot still holding it may let go.
    if (claimedBy.current !== element) return;
    claimedBy.current = null;
    setShowing(false);
  }, []);

  // Background warm-up: not before the page has loaded, and then only in an
  // idle slice of its own. Everything the reader can actually act on — the
  // command palette above all — is live before a WebGL context is built.
  const pageLoaded = usePageLoaded();
  useEffect(() => {
    if (!enabled || warm || !pageLoaded) return;
    return whenIdle(() => setWarm(true));
  }, [enabled, warm, pageLoaded]);

  // Approach warm-up: the cursor is heading at the row, so start now rather
  // than waiting for it to land. Costs one passive listener until it fires.
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

  // Park the shader on the first icon so warming has somewhere to be. Its mask
  // is the one that is already prepared when a hover lands there.
  useEffect(() => {
    if (!warm || placement) return;
    const first = slots.current[0];
    if (!first) return;
    const parked = placementFor(first.element, first.maskSrc);
    if (parked) setPlacement(parked);
  }, [warm, placement, placementFor]);

  // Prepare the masks — the claimed one first, then the rest of the row, one
  // at a time. Each is a Poisson pre-pass (see gem-smoke-mask.ts) and they are
  // deliberately serial: the point of doing this in the background is that the
  // page stays answerable while it happens.
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
          continue; // a mask that will not load is one icon without a glow
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

  // The mask for wherever the shader currently is — and the gate on showing it
  // at all. No prepared mask, no shader: the alternative is the unmasked box.
  const mask =
    placement && masks[placement.maskSrc]
      ? preparedGemSmokeMask(placement.maskSrc)
      : null;

  // Memoised because ShaderMount re-processes and re-uploads its textures
  // whenever this object's IDENTITY changes — a fresh one per render would
  // rebuild the texture on every hover, theme read and parent re-render.
  const uniforms = useMemo(
    () => (mask ? { ...gemSmokeUniforms(mask, colors) } : null),
    // `colors` is derived from `theme` alone; depending on the array would
    // defeat the memo for the same reason.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mask, theme],
  );

  // Stable, because a slot re-registers and re-claims whenever this changes —
  // and a fresh object per render would make that a loop rather than an event.
  const stage = useMemo(
    () => ({ register, claim, release }),
    [register, claim, release],
  );

  return (
    <StageContext.Provider value={stage}>
      <div ref={stageRef} className={stageStyle}>
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
            width={ICON_PX}
            height={ICON_PX}
            speed={showing ? 1 : 0}
            maxPixelCount={SHADER_MAX_PIXELS}
          />
        )}
      </div>
    </StageContext.Provider>
  );
}

/**
 * One icon's place in the row: it draws the line icon, and tells the stage
 * when the shader belongs over it.
 */
export function SocialIconShader({
  maskSrc,
  active,
  children,
}: {
  maskSrc: string;
  active: boolean;
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
    <span ref={slotRef} className={slotStyle}>
      <span
        className={cx(iconLayerStyle, active && iconHiddenStyle)}
        aria-hidden
      >
        {children}
      </span>
    </span>
  );
}
