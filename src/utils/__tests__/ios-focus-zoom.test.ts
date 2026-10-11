// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { guardIosFocusZoom } from "../ios-focus-zoom";

const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1";
// iPadOS asks for desktop sites: a Mac's user agent, told apart by its touch points.
const MAC =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15";
const ANDROID =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36";

function viewport(content: string) {
  const meta = document.createElement("meta");
  meta.name = "viewport";
  meta.content = content;
  document.head.append(meta);
  return meta;
}

describe("guardIosFocusZoom", () => {
  afterEach(() => {
    document.head.innerHTML = "";
  });

  it("caps the scale at 1 on an iPhone", () => {
    const meta = viewport("width=device-width, initial-scale=1");
    guardIosFocusZoom(document, { userAgent: IPHONE, maxTouchPoints: 5 });
    expect(meta.content).toBe("width=device-width, initial-scale=1, maximum-scale=1");
  });

  it("caps the scale on an iPad asking for the desktop site", () => {
    const meta = viewport("width=device-width, initial-scale=1");
    guardIosFocusZoom(document, { userAgent: MAC, maxTouchPoints: 5 });
    expect(meta.content).toBe("width=device-width, initial-scale=1, maximum-scale=1");
  });

  it("replaces a maximum scale already set, and caps only once", () => {
    const meta = viewport("width=device-width, maximum-scale=5");
    guardIosFocusZoom(document, { userAgent: IPHONE, maxTouchPoints: 5 });
    guardIosFocusZoom(document, { userAgent: IPHONE, maxTouchPoints: 5 });
    expect(meta.content).toBe("width=device-width, maximum-scale=1");
  });

  it("leaves Android, which keeps pinch-zoom only without a cap, and a Mac alone", () => {
    const meta = viewport("width=device-width, initial-scale=1");
    guardIosFocusZoom(document, { userAgent: ANDROID, maxTouchPoints: 5 });
    guardIosFocusZoom(document, { userAgent: MAC, maxTouchPoints: 0 });
    expect(meta.content).toBe("width=device-width, initial-scale=1");
  });

  it("does nothing without a viewport tag", () => {
    expect(() => guardIosFocusZoom(document, { userAgent: IPHONE, maxTouchPoints: 5 })).not.toThrow();
  });
});
