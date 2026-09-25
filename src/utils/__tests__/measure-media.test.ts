// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { measureMediaFile } from "../measure-media";

// jsdom loads no media, so created elements are stubbed to answer as the platform would.
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

  it("reads a clip's size off a <video> instead", async () => {
    stub = { width: 1280, height: 720, event: "loadedmetadata" };
    await expect(measureMediaFile(fileOf("video/mp4"))).resolves.toEqual({
      width: 1280,
      height: 720,
    });
    expect(created).toEqual(["video"]);
  });

  it("answers nothing rather than throwing when the source will not decode", async () => {
    stub = { width: 0, height: 0, event: "error" };
    await expect(measureMediaFile(fileOf("image/png"))).resolves.toBeNull();
  });

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
