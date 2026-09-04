// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { measureMediaFile } from "../measure-media";

// jsdom loads nothing — an <img> whose src is set never fires anything, and a
// <video> has no media stack at all. So the elements the measurement asks for
// are stubbed at `document.createElement`, and each one answers the way the
// platform would: a size, an event, or a failure.
type Stub = {
  width: number;
  height: number;
  event: "load" | "loadedmetadata" | "error";
};

let stub: Stub | null = null;
let created: string[] = [];
const realCreateElement = document.createElement.bind(document);

beforeEach(() => {
  stub = null;
  created = [];
  URL.createObjectURL = vi.fn(() => "blob:stub");
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(document, "createElement").mockImplementation(((
    tag: string,
    ...rest: unknown[]
  ) => {
    const node = realCreateElement(tag, ...(rest as []));
    if (!stub || (tag !== "img" && tag !== "video")) return node;
    created.push(tag);
    const { width, height, event } = stub;
    Object.defineProperty(node, "naturalWidth", { value: width });
    Object.defineProperty(node, "naturalHeight", { value: height });
    Object.defineProperty(node, "videoWidth", { value: width });
    Object.defineProperty(node, "videoHeight", { value: height });
    Object.defineProperty(node, "src", {
      set() {
        queueMicrotask(() => node.dispatchEvent(new Event(event)));
      },
      configurable: true,
    });
    return node;
  }) as typeof document.createElement);
});

afterEach(() => vi.restoreAllMocks());

const fileOf = (type: string) => new File(["x"], "shot.png", { type });

describe("measureMediaFile", () => {
  it("decodes a picture and reports its natural size", async () => {
    stub = { width: 1600, height: 900, event: "load" };
    await expect(measureMediaFile(fileOf("image/png"))).resolves.toEqual({
      width: 1600,
      height: 900,
    });
    expect(created).toEqual(["img"]);
  });

  // The fork is the CONTENT TYPE's, exactly as it is for the element a document
  // renders with (`mediaKindOf`) — an <img> cannot decode an mp4, and asking it
  // to would only produce a failed measurement for every clip in the library.
  it("reads a clip's size off a <video> instead", async () => {
    stub = { width: 1280, height: 720, event: "loadedmetadata" };
    await expect(measureMediaFile(fileOf("video/mp4"))).resolves.toEqual({
      width: 1280,
      height: 720,
    });
    expect(created).toEqual(["video"]);
  });

  // A measurement that fails is not an upload that fails. The dimensions are an
  // optimisation — a box reserved at the right shape instead of the house one —
  // so a source the browser cannot decode is stored without them.
  it("answers nothing rather than throwing when the source will not decode", async () => {
    stub = { width: 0, height: 0, event: "error" };
    await expect(measureMediaFile(fileOf("image/png"))).resolves.toBeNull();
  });

  // Zero is what an element that decoded NOTHING reports, and it is the one
  // value that must never reach the document: a stored `0` would be a shape
  // claim no picture can have, and the schema refuses it anyway.
  it("answers nothing for a source that decodes to no size at all", async () => {
    stub = { width: 0, height: 0, event: "load" };
    await expect(measureMediaFile(fileOf("image/png"))).resolves.toBeNull();
  });

  it("releases the object URL either way", async () => {
    stub = { width: 1600, height: 900, event: "load" };
    await measureMediaFile(fileOf("image/png"));
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:stub");

    stub = { width: 0, height: 0, event: "error" };
    await measureMediaFile(fileOf("image/png"));
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(2);
  });

  // A decoder that stalls, or a source that fires neither event, must not hold
  // an upload open: the measurement is an optimisation, and giving up on it
  // costs the picture nothing but the house ratio.
  it("gives up on a source that never answers at all", async () => {
    vi.useFakeTimers();
    stub = null; // no stubbed src setter, so nothing is ever dispatched
    const measuring = measureMediaFile(fileOf("image/png"));
    await vi.advanceTimersByTimeAsync(3000);
    await expect(measuring).resolves.toBeNull();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:stub");
    vi.useRealTimers();
  });
});
