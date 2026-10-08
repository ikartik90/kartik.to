// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import DiveLayout from "../layout";

const WIDGET = {
  src: "https://inflight.co/widget.js",
  "data-org": "aius9qpt",
  "data-path": "/dive",
  async: "",
};

const attributes = (el: Element) => Object.fromEntries([...el.attributes].map((a) => [a.name, a.value]));

afterEach(cleanup);

describe("DiveLayout", () => {
  it("serves the Inflight widget, kept to /dive, in the page's head", () => {
    const page = new DOMParser().parseFromString(
      renderToString(
        <html>
          <head />
          <body>
            <DiveLayout>
              <main>Review</main>
            </DiveLayout>
          </body>
        </html>,
      ),
      "text/html",
    );
    const widgets = page.querySelectorAll(`script[src="${WIDGET.src}"]`);
    expect(widgets).toHaveLength(1);
    expect(widgets[0].parentElement).toBe(page.head);
    expect(attributes(widgets[0])).toEqual(WIDGET);
    expect(page.querySelector("main")?.textContent).toBe("Review");
  });

  it("adds it to the head once when the review is reached in the browser", () => {
    render(
      <DiveLayout>
        <main>Review</main>
      </DiveLayout>,
    );
    const widgets = document.querySelectorAll(`script[src="${WIDGET.src}"]`);
    expect(widgets).toHaveLength(1);
    expect(widgets[0].parentElement).toBe(document.head);
    expect(attributes(widgets[0])).toEqual(WIDGET);
  });
});
