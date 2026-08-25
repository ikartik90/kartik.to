// @vitest-environment jsdom
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The mask pre-pass is canvas + WebGL work jsdom cannot do; stand in with a
// controllable one, since WHEN a mask becomes ready is what this file is about.
const maskStub = vi.hoisted(() => {
  const prepared = new Map<string, { src: string }>();
  const waiting: Array<() => void> = [];
  let manual = false;
  return {
    prepared,
    waiting,
    hold: (on: boolean) => {
      manual = on;
    },
    releaseAll: () => {
      waiting.splice(0).forEach((settle) => settle());
    },
    prepare(src: string) {
      const settle = () => prepared.set(src, { src });
      if (!manual) {
        settle();
        return Promise.resolve(prepared.get(src));
      }
      return new Promise((resolve) =>
        waiting.push(() => {
          settle();
          resolve(prepared.get(src));
        }),
      );
    },
    reset() {
      prepared.clear();
      waiting.length = 0;
      manual = false;
    },
  };
});

vi.mock("@/utils/gem-smoke-mask", () => ({
  prepareGemSmokeMask: (src: string) => maskStub.prepare(src),
  preparedGemSmokeMask: (src: string) => maskStub.prepared.get(src) ?? null,
}));

// ShaderMount is WebGL; stand in with a marker that reports the mask it was
// handed, so "which icon is it wearing" is observable.
vi.mock("@paper-design/shaders-react", () => ({
  ShaderMount: ({
    uniforms,
    ...props
  }: {
    uniforms: { u_image?: { src: string } };
    "data-shader-active"?: string;
  }) => (
    <div
      data-social-icon-shader
      data-mask-src={uniforms.u_image?.src}
      data-shader-active={props["data-shader-active"]}
    />
  ),
}));

import { SocialIconShader, SocialShaderStage } from "../social-icon-shader";

const MASKS = ["/a.svg", "/b.svg", "/c.svg", "/d.svg"];

function row(hovered: number | null = null) {
  return (
    <SocialShaderStage>
      {MASKS.map((mask, i) => (
        <SocialIconShader key={mask} maskSrc={mask} active={i === hovered}>
          <span data-icon={i} />
        </SocialIconShader>
      ))}
    </SocialShaderStage>
  );
}

const shaders = () =>
  document.querySelectorAll<HTMLElement>("[data-social-icon-shader]");

/** Pin the document's load state, which gates the background warm-up. */
function setReadyState(state: DocumentReadyState) {
  Object.defineProperty(document, "readyState", {
    value: state,
    configurable: true,
  });
}

/** A row sitting above the pointer, since jsdom measures everything as 0×0. */
function stubRowBox() {
  const box = { left: 100, top: 100, right: 300, bottom: 120 };
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({
    ...box,
    x: box.left,
    y: box.top,
    width: box.right - box.left,
    height: box.bottom - box.top,
    toJSON: () => ({}),
  } as DOMRect);
}

/** One idle slice, plus the microtasks a mask resolves on. */
async function tick() {
  await act(async () => {
    vi.advanceTimersToNextTimer();
  });
}

async function moveTo(x: number, y: number) {
  await act(async () => {
    window.dispatchEvent(
      new MouseEvent("pointermove", { clientX: x, clientY: y }),
    );
    vi.advanceTimersByTime(50);
  });
}

describe("SocialShaderStage", () => {
  beforeEach(() => {
    maskStub.reset();
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
    setReadyState("complete");
  });

  it("holds nothing back for the row's first frame", () => {
    render(row());
    // The whole point of the background warm: hydration finishes, the page can
    // answer a keypress, and only then does a WebGL context get built.
    expect(shaders().length).toBe(0);
  });

  it("warms exactly one shader for the whole row, not one per icon", async () => {
    render(row());
    await tick();
    expect(shaders().length).toBe(1);
  });

  it("waits for the mask before it mounts anything at all", async () => {
    maskStub.hold(true);
    render(row());
    await tick();
    // A shader without its mask draws the smoke over its whole box — so there
    // is no such state to show. It arrives masked or not at all.
    expect(shaders().length).toBe(0);

    await act(async () => {
      maskStub.releaseAll();
    });
    expect(shaders().length).toBe(1);
  });

  it("moves that one shader between icons instead of mounting a second", async () => {
    const { rerender } = render(row());
    await tick();
    const first = shaders()[0];

    await act(async () => {
      rerender(row(2));
    });

    expect(shaders().length).toBe(1);
    expect(shaders()[0].getAttribute("data-mask-src")).toBe(MASKS[2]);
    // The same element: a remount would be a new WebGL context and a fresh
    // compile, which is the cost this stage exists to pay only once.
    expect(shaders()[0]).toBe(first);
  });

  it("mounts on hover for a reader who arrives before the warm-up has run", async () => {
    await act(async () => {
      render(row(1));
    });
    expect(shaders().length).toBe(1);
    expect(shaders()[0].getAttribute("data-mask-src")).toBe(MASKS[1]);
  });

  it("keeps the shader mounted once the hover ends, so the context survives", async () => {
    const { rerender } = render(row(1));
    await act(async () => {
      rerender(row(null));
    });
    expect(shaders().length).toBe(1);
    // Parked on the icon it last covered — re-pointing it would swap a mask
    // for a hover that is over.
    expect(shaders()[0].getAttribute("data-mask-src")).toBe(MASKS[1]);
    expect(shaders()[0].getAttribute("data-shader-active")).toBeNull();
  });

  it("holds the background warm-up until the page has loaded", async () => {
    setReadyState("loading");
    render(row());
    await tick();
    await tick();
    expect(shaders().length).toBe(0);
  });

  it("warms early for a pointer heading at the row, load or no load", async () => {
    // Loading, so nothing but the approach can account for what mounts.
    setReadyState("loading");
    stubRowBox();
    render(row());
    expect(shaders().length).toBe(0);

    // Two samples: below the row, travelling up at it.
    await moveTo(200, 400);
    await moveTo(200, 320);

    expect(shaders().length).toBe(1);
  });

  it("stays cold for a pointer moving away from the row", async () => {
    setReadyState("loading");
    stubRowBox();
    render(row());

    await moveTo(200, 400);
    await moveTo(200, 600);

    expect(shaders().length).toBe(0);
  });
});
