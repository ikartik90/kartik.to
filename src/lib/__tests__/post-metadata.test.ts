import { describe, expect, it } from "vitest";
import type { Post } from "@/domain/post";
import { SITE_TITLE } from "@/data/site";
import { homeMetadata, postMetadata, projectMetadata, siteCard } from "../post-metadata";

const NOW = new Date("2026-09-10T00:00:00.000Z");

const PROJECT: Post = {
  id: "p1",
  title: "Redesigning Shift Scheduling",
  slug: "scheduling-extensions",
  category: "WORK",
  content: { type: "doc", content: [] },
  publishedAt: NOW,
  createdAt: NOW,
  updatedAt: NOW,
};

describe("postMetadata", () => {
  const metadata = postMetadata(PROJECT, "/work/scheduling-extensions", "Project");

  it("names the page as its own canonical address", () => {
    expect(metadata.alternates?.canonical).toBe("/work/scheduling-extensions");
  });

  it("points agents at the Markdown copy of the page", () => {
    expect(metadata.alternates?.types).toEqual({
      "text/markdown": "/work/scheduling-extensions.md",
    });
  });

  it("credits the author on the card", () => {
    expect(metadata.openGraph).toMatchObject({ authors: ["Kartik Iyer"] });
    expect(metadata.twitter).toMatchObject({ creator: "@ikartik90" });
  });

  it("titles the page with the post's own title by default", () => {
    expect(metadata.title).toBe("Redesigning Shift Scheduling");
    expect(metadata.openGraph).toMatchObject({
      title: "Redesigning Shift Scheduling",
    });
  });

  it("can title the page for search instead, in full, on the page and its card", () => {
    const searchTitle = "About Kartik Iyer — Product Designer";
    const about = postMetadata(
      { ...PROJECT, category: "PAGE", slug: "about", title: "About Me" },
      "/about",
      "About",
      { searchTitle },
    );
    expect(about.title).toEqual({ absolute: searchTitle });
    expect(about.openGraph).toMatchObject({ title: searchTitle });
    expect(about.twitter).toMatchObject({ title: searchTitle });
  });

  it("can name another address as canonical, keeping its own on its card", () => {
    const replaced = postMetadata(PROJECT, "/work/scheduling-extensions", "Project", {
      canonical: "/projects/shift-scheduling",
    });
    expect(replaced.alternates?.canonical).toBe("/projects/shift-scheduling");
    expect(replaced.openGraph).toMatchObject({ url: "/work/scheduling-extensions" });
  });

  it("is a bare title for a post that does not exist", () => {
    expect(postMetadata(null, "/work/nope", "Project")).toEqual({
      title: "Project",
    });
  });

  it("describes the page with the author's written description where there is one", () => {
    const described = postMetadata(
      {
        ...PROJECT,
        description: "Written for search.",
        content: {
          type: "doc",
          content: [
            {
              type: "paragraph",
              children: [{ type: "text", text: "The opening line." }],
            },
          ],
        },
      },
      "/work/scheduling-extensions",
      "Project",
    );
    expect(described.description).toBe("Written for search.");
    expect(described.openGraph).toMatchObject({
      description: "Written for search.",
    });
    expect(described.twitter).toMatchObject({
      description: "Written for search.",
    });
  });
});

describe("siteCard", () => {
  it("is the site's own card, described as asked", () => {
    const card = siteCard("A line.");
    expect(card.openGraph).toMatchObject({
      type: "website",
      siteName: "kartik.to",
      title: SITE_TITLE,
      description: "A line.",
    });
    expect(card.twitter).toMatchObject({
      card: "summary_large_image",
      title: SITE_TITLE,
      description: "A line.",
      creator: "@ikartik90",
    });
  });
});

describe("projectMetadata", () => {
  const metadata = projectMetadata(
    "Shift scheduling",
    "Made posted schedules extendable",
    "/projects/shift-scheduling",
    "/og/projects/shift-scheduling.png",
  );

  it("names the project's address as its own, and points agents at its Markdown copy", () => {
    expect(metadata.alternates).toEqual({
      canonical: "/projects/shift-scheduling",
      types: { "text/markdown": "/projects/shift-scheduling.md" },
    });
  });

  it("titles and describes the page and its card with the project's", () => {
    expect(metadata.title).toBe("Shift scheduling");
    expect(metadata.description).toBe("Made posted schedules extendable");
    expect(metadata.openGraph).toMatchObject({
      type: "website",
      url: "/projects/shift-scheduling",
      siteName: "kartik.to",
      title: "Shift scheduling",
      description: "Made posted schedules extendable",
    });
    expect(metadata.twitter).toMatchObject({
      card: "summary_large_image",
      title: "Shift scheduling",
      description: "Made posted schedules extendable",
      creator: "@ikartik90",
    });
  });

  it("previews the link with the project's card, named as the card is", () => {
    const image = {
      url: "/og/projects/shift-scheduling.png",
      width: 1200,
      height: 630,
      alt: "Shift scheduling: Made posted schedules extendable",
    };
    expect(metadata.openGraph).toMatchObject({ images: [image] });
    expect(metadata.twitter).toMatchObject({ images: [image] });
  });
});

describe("homeMetadata", () => {
  it("names the homepage as its own address and inherits the rest", () => {
    expect(homeMetadata(null)).toEqual({ alternates: { canonical: "/" } });
  });

  it("describes the homepage with a written description, on its card too", () => {
    const metadata = homeMetadata("Written for search.");
    expect(metadata.description).toBe("Written for search.");
    expect(metadata).toMatchObject(siteCard("Written for search."));
    expect(metadata.alternates).toEqual({ canonical: "/" });
  });
});
