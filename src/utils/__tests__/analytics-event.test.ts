import { describe, it, expect } from "vitest";
import { dropStealthEvents } from "../analytics-event";

const at = (url: string) => ({ type: "pageview" as const, url });

describe("dropStealthEvents", () => {
  it("passes a public page through untouched", () => {
    const event = at("https://kartik.to/writing/some-post");
    expect(dropStealthEvents(event)).toBe(event);
  });

  it("reports the pages the site actually advertises", () => {
    for (const path of [
      "/",
      "/writing/some-post",
      "/work/some-project",
      "/playground/shader",
      "/playground/shader/abc123",
      "/playground/calchemy",
      "/playground/icons",
    ]) {
      expect(dropStealthEvents(at(`https://kartik.to${path}`))).not.toBeNull();
    }
  });

  it("reports /vouch — unlisted, but deliberately public", () => {
    // The one route handed out to other people on purpose. Obscurity is not
    // privacy here (see app/vouch/page.tsx), and how many of them open it is
    // exactly the number worth having.
    expect(dropStealthEvents(at("https://kartik.to/vouch"))).not.toBeNull();
  });

  it("drops every editor route", () => {
    for (const path of [
      "/edit",
      "/edit/new",
      "/edit/home",
      "/edit/testimonials",
      "/edit/some-post",
      "/writing/new",
      "/writing/some-post/edit",
      "/admin",
      "/admin/anything",
    ]) {
      expect(dropStealthEvents(at(`https://kartik.to${path}`))).toBeNull();
    }
  });

  it("drops an editor route carrying a query string or hash", () => {
    expect(
      dropStealthEvents(at("https://kartik.to/edit/new?category=ARTICLE")),
    ).toBeNull();
    expect(
      dropStealthEvents(at("https://kartik.to/edit/some-post#block-3")),
    ).toBeNull();
  });

  it("keeps a public path that merely starts with a stealth prefix", () => {
    // `/editorial` is not `/edit`, and `/work/edit-workflow` is not an editor.
    for (const path of [
      "/editorial",
      "/writing/editing-well",
      "/work/edit-workflow",
      "/administration",
    ]) {
      expect(dropStealthEvents(at(`https://kartik.to${path}`))).not.toBeNull();
    }
  });

  it("ignores the host, so previews and localhost filter the same way", () => {
    expect(
      dropStealthEvents(at("http://localhost:3000/edit/home")),
    ).toBeNull();
    expect(
      dropStealthEvents(at("https://kartik-to-git-branch.vercel.app/edit/new")),
    ).toBeNull();
  });

  it("accepts a bare path, not just an absolute URL", () => {
    // Both vendors build `url` inside their remote script, so the shape is
    // theirs to choose and not ours to assume. Handle either.
    expect(dropStealthEvents(at("/edit/home"))).toBeNull();
    expect(dropStealthEvents(at("/writing/some-post/edit"))).toBeNull();
    expect(dropStealthEvents(at("/edit/new?category=WORK"))).toBeNull();
    expect(dropStealthEvents(at("/writing/some-post"))).not.toBeNull();
  });

  it("ignores a trailing slash", () => {
    expect(dropStealthEvents(at("/edit/"))).toBeNull();
    expect(dropStealthEvents(at("/writing/new/"))).toBeNull();
    expect(dropStealthEvents(at("/"))).not.toBeNull();
  });

  it("drops anything that is neither a URL nor a path", () => {
    // Unrecognizable means unknown, and an unknown page might be an editor
    // one. A missed pageview costs a number; a leaked one costs the point.
    expect(dropStealthEvents(at("not a url"))).toBeNull();
    expect(dropStealthEvents(at(""))).toBeNull();
  });
});
