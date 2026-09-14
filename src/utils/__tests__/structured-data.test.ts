import { describe, expect, it } from "vitest";
import type { Post } from "@/domain/post";
import {
  homeJsonLd,
  postJsonLd,
  serializeJsonLd,
  type JsonLd,
} from "../structured-data";

const SITE = "https://kartik.to";

const graph = (data: JsonLd) => data["@graph"];
const ofType = (data: JsonLd, type: string) =>
  graph(data).find((node) => node["@type"] === type);

const post = (overrides: Partial<Post> = {}): Post => ({
  id: "p1",
  title: "Redesigning Shift Scheduling",
  slug: "scheduling-extensions",
  category: "WORK",
  content: {
    type: "doc",
    content: [
      {
        type: "paragraph",
        children: [{ type: "text", text: "Shifts were a critical lever." }],
      },
    ],
  },
  publishedAt: new Date("2026-09-10T07:04:39.143Z"),
  createdAt: new Date("2026-09-01T00:00:00.000Z"),
  updatedAt: new Date("2026-09-12T00:00:00.000Z"),
  ...overrides,
});

describe("homeJsonLd", () => {
  const data = homeJsonLd(SITE);

  it("is one schema.org graph", () => {
    expect(data["@context"]).toBe("https://schema.org");
    expect(graph(data).length).toBeGreaterThan(0);
  });

  it("names the person, what they do and where", () => {
    const person = ofType(data, "Person")!;
    expect(person).toMatchObject({
      "@id": `${SITE}/#person`,
      name: "Kartik Iyer",
      url: SITE,
      jobTitle: ["Product Designer", "Founding Designer", "Design Engineer"],
      homeLocation: {
        "@type": "Place",
        address: {
          "@type": "PostalAddress",
          addressLocality: "Toronto",
          addressRegion: "Ontario",
          addressCountry: "CA",
        },
      },
    });
  });

  it("ties the person to their profiles elsewhere", () => {
    expect(ofType(data, "Person")!.sameAs).toEqual(
      expect.arrayContaining([
        "https://github.com/ikartik90",
        "https://linkedin.com/in/ikartik90",
      ]),
    );
  });

  it("describes the homepage as the person's profile on the site", () => {
    expect(ofType(data, "ProfilePage")).toMatchObject({
      url: SITE,
      mainEntity: { "@id": `${SITE}/#person` },
      isPartOf: { "@id": `${SITE}/#website` },
    });
    expect(ofType(data, "WebSite")).toMatchObject({
      "@id": `${SITE}/#website`,
      url: SITE,
      name: "kartik.to",
      publisher: { "@id": `${SITE}/#person` },
    });
  });
});

describe("postJsonLd", () => {
  it("describes a project as an Article by the person", () => {
    const article = ofType(postJsonLd(post(), SITE), "Article")!;
    const url = `${SITE}/work/scheduling-extensions`;
    expect(article).toMatchObject({
      "@id": `${url}#article`,
      url,
      mainEntityOfPage: url,
      headline: "Redesigning Shift Scheduling",
      description: "Shifts were a critical lever.",
      datePublished: "2026-09-10T07:04:39.143Z",
      dateModified: "2026-09-12T00:00:00.000Z",
      image: `${url}/opengraph-image`,
      author: { "@id": `${SITE}/#person` },
      isPartOf: { "@id": `${SITE}/#website` },
    });
  });

  it("carries the person, so the author resolves on the page itself", () => {
    expect(ofType(postJsonLd(post(), SITE), "Person")).toMatchObject({
      "@id": `${SITE}/#person`,
    });
  });

  it("describes writing as a BlogPosting at its own address", () => {
    const data = postJsonLd(post({ category: "ARTICLE", slug: "on-craft" }), SITE);
    expect(ofType(data, "BlogPosting")).toMatchObject({
      url: `${SITE}/writing/on-craft`,
    });
  });

  it("falls back to a name for a post without a title", () => {
    const article = ofType(postJsonLd(post({ title: null }), SITE), "Article")!;
    expect(article.headline).toBe("Project");
  });

  it("says nothing it does not know", () => {
    const article = ofType(
      postJsonLd(
        post({ publishedAt: null, content: { type: "doc", content: [] } }),
        SITE,
      ),
      "Article",
    )!;
    expect(article).not.toHaveProperty("datePublished");
    expect(article).not.toHaveProperty("description");
  });
});

describe("serializeJsonLd", () => {
  it("cannot close the script tag it is written into", () => {
    const serialized = serializeJsonLd({ headline: "</script><script>alert(1)" });
    expect(serialized).not.toContain("<");
    expect(JSON.parse(serialized)).toEqual({
      headline: "</script><script>alert(1)",
    });
  });
});
