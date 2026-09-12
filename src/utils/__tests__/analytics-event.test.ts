import { afterEach, describe, it, expect } from "vitest";
import { dropPrivateEvents } from "../analytics-event";
import { setAnalyticsOptOut } from "../analytics-opt-out";

const at = (url: string) => ({ type: "pageview" as const, url });

// Every case below but the last group is a visitor's browser, which carries no
// mark. The mark is stored, so it would otherwise leak from one case to the next.
afterEach(() => localStorage.clear());

describe("dropPrivateEvents", () => {
  it("passes a public page through untouched", () => {
    const event = at("https://kartik.to/writing/some-post");
    expect(dropPrivateEvents(event)).toBe(event);
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
      expect(dropPrivateEvents(at(`https://kartik.to${path}`))).not.toBeNull();
    }
  });

  it("reports /vouch — unlisted, but deliberately public", () => {
    // The one route handed out to other people on purpose. Obscurity is not
    // privacy here (see app/vouch/page.tsx), and how many of them open it is
    // exactly the number worth having.
    expect(dropPrivateEvents(at("https://kartik.to/vouch"))).not.toBeNull();
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
      expect(dropPrivateEvents(at(`https://kartik.to${path}`))).toBeNull();
    }
  });

  it("drops an editor route carrying a query string or hash", () => {
    expect(
      dropPrivateEvents(at("https://kartik.to/edit/new?category=ARTICLE")),
    ).toBeNull();
    expect(
      dropPrivateEvents(at("https://kartik.to/edit/some-post#block-3")),
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
      expect(dropPrivateEvents(at(`https://kartik.to${path}`))).not.toBeNull();
    }
  });

  it("ignores the host, so previews and localhost filter the same way", () => {
    expect(dropPrivateEvents(at("http://localhost:3000/edit/home"))).toBeNull();
    expect(
      dropPrivateEvents(at("https://kartik-to-git-branch.vercel.app/edit/new")),
    ).toBeNull();
  });

  it("accepts a bare path, not just an absolute URL", () => {
    // Both vendors build `url` inside their remote script, so the shape is
    // theirs to choose and not ours to assume. Handle either.
    expect(dropPrivateEvents(at("/edit/home"))).toBeNull();
    expect(dropPrivateEvents(at("/writing/some-post/edit"))).toBeNull();
    expect(dropPrivateEvents(at("/edit/new?category=WORK"))).toBeNull();
    expect(dropPrivateEvents(at("/writing/some-post"))).not.toBeNull();
  });

  it("ignores a trailing slash", () => {
    expect(dropPrivateEvents(at("/edit/"))).toBeNull();
    expect(dropPrivateEvents(at("/writing/new/"))).toBeNull();
    expect(dropPrivateEvents(at("/"))).not.toBeNull();
  });

  it("drops anything that is neither a URL nor a path", () => {
    // Unrecognizable means unknown, and an unknown page might be an editor
    // one. A missed pageview costs a number; a leaked one costs the point.
    expect(dropPrivateEvents(at("not a url"))).toBeNull();
    expect(dropPrivateEvents(at(""))).toBeNull();
  });
  it("drops every page once the browser is marked as the author's", () => {
    // The reason this filter exists twice over: `/edit/*` is dropped because
    // nobody else can reach it, and everything ELSE is dropped on this browser
    // because the author reading their own site is not traffic. Same lever,
    // returning `null`, so neither leaves the page.
    setAnalyticsOptOut(true);
    for (const path of [
      "/",
      "/writing/some-post",
      "/work/some-project",
      "/playground/shader",
      "/vouch",
    ]) {
      expect(dropPrivateEvents(at(`https://kartik.to${path}`))).toBeNull();
    }
  });

  it("counts the same pages again once the browser opts back in", () => {
    setAnalyticsOptOut(true);
    setAnalyticsOptOut(false);
    const event = at("https://kartik.to/writing/some-post");
    expect(dropPrivateEvents(event)).toBe(event);
  });

  it("reads the mark per event, not once when the filter was handed over", () => {
    // `beforeSend` is registered with the vendor script at mount and called for
    // every event after that. Closing over the answer would mean a browser
    // marked mid-session keeps reporting until the next full reload.
    const event = at("https://kartik.to/");
    expect(dropPrivateEvents(event)).toBe(event);
    setAnalyticsOptOut(true);
    expect(dropPrivateEvents(event)).toBeNull();
  });
});
