import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { JsonLd } from "../json-ld";

describe("JsonLd", () => {
  it("writes the data as a JSON-LD script", () => {
    const data = { "@context": "https://schema.org", "@type": "Person", name: "A" };
    const { container } = render(<JsonLd data={data} />);
    const script = container.querySelector('script[type="application/ld+json"]');
    expect(JSON.parse(script!.textContent!)).toEqual(data);
  });

  it("escapes markup inside the data", () => {
    const { container } = render(<JsonLd data={{ name: "</script>" }} />);
    expect(container.querySelector("script")!.innerHTML).not.toContain("</");
  });
});
