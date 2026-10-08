// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { floatsOverContent } from "../floats-over-content";

function mount(html: string) {
  document.body.innerHTML = html;
  return document.querySelector("button")!;
}

describe("floatsOverContent", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("is false for a button in the page's flow", () => {
    expect(floatsOverContent(mount(`<div><p><button>Save</button></p></div>`))).toBe(false);
  });

  it("is true inside a sticky row with no background, which content scrolls under", () => {
    expect(
      floatsOverContent(
        mount(`<div style="background-color: rgb(40, 40, 40)">
          <div style="position: sticky; top: 0"><button>Close</button></div>
        </div>`),
      ),
    ).toBe(true);
  });

  it("is true inside a fixed or absolute container with no background", () => {
    expect(floatsOverContent(mount(`<div style="position: fixed"><span><button>Next</button></span></div>`))).toBe(true);
    expect(floatsOverContent(mount(`<div style="position: absolute"><button>Next</button></div>`))).toBe(true);
  });

  it("is true for a button positioned absolutely itself, over its container's content", () => {
    expect(
      floatsOverContent(
        mount(`<div style="background-color: rgb(40, 40, 40); position: relative">
          <button style="position: absolute">Close</button>
        </div>`),
      ),
    ).toBe(true);
  });

  it("is false when a surface between it and the floating container moves with it", () => {
    expect(
      floatsOverContent(
        mount(`<div style="position: fixed"><div style="background-color: rgb(40, 40, 40)"><button>Undo</button></div></div>`),
      ),
    ).toBe(false);
    expect(
      floatsOverContent(mount(`<div style="position: fixed; background-color: rgba(40, 40, 40, 0.75)"><button>Undo</button></div>`)),
    ).toBe(false);
    expect(
      floatsOverContent(mount(`<div style="position: fixed; background-image: linear-gradient(red, blue)"><button>Undo</button></div>`)),
    ).toBe(false);
  });

  it("treats a fully transparent fill as no surface", () => {
    expect(
      floatsOverContent(mount(`<div style="position: sticky; background-color: rgba(0, 0, 0, 0)"><button>Close</button></div>`)),
    ).toBe(true);
  });

  it("is false for a relatively positioned container, which stays in the flow", () => {
    expect(floatsOverContent(mount(`<div style="position: relative"><button>Save</button></div>`))).toBe(false);
  });
});
