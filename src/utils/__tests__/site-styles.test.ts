import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { preinit } = vi.hoisted(() => ({
  preinit: vi.fn((href: string) => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.setAttribute("href", href);
    document.head.append(link);
  }),
}));
vi.mock("react-dom", async (original) => ({ ...(await original<typeof import("react-dom")>()), preinit }));

const HREF = "/styles/site.abc123.css";
const fresh = async () => (await import("../site-styles")).loadSiteStyles;
const link = () => document.head.querySelector<HTMLLinkElement>(`link[href="${HREF}"]`)!;
const settled = async (promise: Promise<void>) => {
  let done = false;
  void promise.then(() => (done = true));
  await new Promise((resolve) => setTimeout(resolve));
  return done;
};

let downloaded: () => void;
const fetched = vi.fn(() => new Promise<Response>((resolve) => (downloaded = () => resolve(new Response("")))));

beforeEach(() => {
  vi.resetModules();
  vi.stubGlobal("fetch", fetched);
});
afterEach(() => {
  document.head.innerHTML = "";
  preinit.mockClear();
  fetched.mockClear();
  vi.unstubAllGlobals();
});

describe("loadSiteStyles", () => {
  it("resolves at once where every page carries the whole stylesheet", async () => {
    const loadSiteStyles = await fresh();
    await expect(loadSiteStyles(undefined)).resolves.toBeUndefined();
    expect(preinit).not.toHaveBeenCalled();
    expect(fetched).not.toHaveBeenCalled();
  });

  it("downloads it before adding it, so it is never pending in the head", async () => {
    const loadSiteStyles = await fresh();
    void loadSiteStyles(HREF);
    expect(fetched).toHaveBeenCalledWith(HREF);
    await new Promise((resolve) => setTimeout(resolve));
    expect(preinit).not.toHaveBeenCalled();
    downloaded();
    await new Promise((resolve) => setTimeout(resolve));
    expect(preinit).toHaveBeenCalledOnce();
  });

  it("adds the whole stylesheet after every page's own, and resolves once it has loaded", async () => {
    const loadSiteStyles = await fresh();
    const ready = loadSiteStyles(HREF);
    downloaded();
    await new Promise((resolve) => setTimeout(resolve));
    expect(preinit).toHaveBeenCalledWith(HREF, { as: "style", precedence: "site" });
    expect(await settled(ready)).toBe(false);
    link().dispatchEvent(new Event("load"));
    expect(await settled(ready)).toBe(true);
  });

  it("asks for it once, however many wait on it", async () => {
    const loadSiteStyles = await fresh();
    const first = loadSiteStyles(HREF);
    const second = loadSiteStyles(HREF);
    downloaded();
    await new Promise((resolve) => setTimeout(resolve));
    expect(fetched).toHaveBeenCalledOnce();
    expect(preinit).toHaveBeenCalledOnce();
    link().dispatchEvent(new Event("load"));
    expect(await settled(Promise.all([first, second]).then(() => {}))).toBe(true);
  });

  it("lets what waits go ahead if the stylesheet fails", async () => {
    const loadSiteStyles = await fresh();
    const ready = loadSiteStyles(HREF);
    downloaded();
    await new Promise((resolve) => setTimeout(resolve));
    link().dispatchEvent(new Event("error"));
    expect(await settled(ready)).toBe(true);
  });
});
