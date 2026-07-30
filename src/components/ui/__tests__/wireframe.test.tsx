import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { describe, it, expect, afterEach } from "vitest";
import { Wireframe, Skeleton, useWireframe } from "../wireframe";
import { Typography } from "../typography";
import { Field } from "../input/field";
import { TextInput } from "../input/text-input";
import { Checkbox } from "../input/checkbox";

afterEach(cleanup);

/** Every bar the treatment draws carries `data-skeleton`. */
const bars = (container: HTMLElement) =>
  container.querySelectorAll("[data-skeleton]");

describe("Skeleton", () => {
  it("keeps the text it replaces in the DOM so the bar inherits its natural width", () => {
    const { container } = render(<Skeleton>Shift role</Skeleton>);
    expect(bars(container)).toHaveLength(1);
    expect(container.textContent).toContain("Shift role");
  });

  it("renders one bar per line when asked, for text that does not exist yet", () => {
    const { container } = render(<Skeleton lines={3} />);
    expect(bars(container)).toHaveLength(3);
  });

  it("takes an explicit width when there is no text to measure", () => {
    const { container } = render(<Skeleton width="12ch" />);
    const bar = container.querySelector("[data-skeleton]") as HTMLElement;
    expect(bar.style.width).toBe("12ch");
  });
});

describe("Wireframe scope", () => {
  it("leaves components untouched outside it", () => {
    const { container } = render(
      <Field>
        <Field.Label>Shift role</Field.Label>
      </Field>,
    );
    expect(bars(container)).toHaveLength(0);
    expect(screen.getByText("Shift role")).toBeTruthy();
  });

  it("turns a field's label and hint into bars, keeping the frame intact", () => {
    const { container } = render(
      <Wireframe>
        <TextInput label="Shift role" hint="Pick one" />
      </Wireframe>,
    );
    // Label + hint + the control's value slot.
    expect(bars(container).length).toBeGreaterThanOrEqual(2);
    expect(container.querySelector("[data-field]")).toBeTruthy();
  });

  it("replaces a text control with a bar rather than an editable input", () => {
    render(
      <Wireframe>
        <TextInput label="Shift role" placeholder="Select a role" />
      </Wireframe>,
    );
    expect(screen.queryByRole("textbox")).toBeNull();
    // The placeholder text still sizes the bar it became.
    expect(screen.getByText("Select a role")).toBeTruthy();
  });

  it("renders normally when disabled, so a loading scope needs no JSX branch", () => {
    const { container } = render(
      <Wireframe enabled={false}>
        <TextInput label="Shift role" />
      </Wireframe>,
    );
    expect(bars(container)).toHaveLength(0);
    expect(screen.getByRole("textbox")).toBeTruthy();
  });

  it("restores normal rendering for a nested subtree that opts out", () => {
    const { container } = render(
      <Wireframe>
        <Field>
          <Field.Label>Wireframed</Field.Label>
        </Field>
        <Wireframe enabled={false}>
          <Field>
            <Field.Label>Live</Field.Label>
          </Field>
        </Wireframe>
      </Wireframe>,
    );
    expect(bars(container)).toHaveLength(1);
    expect(screen.getByText("Live").querySelector("[data-skeleton]")).toBeNull();
  });

  it("leaves an explicitly authored Skeleton alone rather than wrapping it again", () => {
    // Stating the shape by hand is the loading case — there is no text to
    // measure. Wrapping it would hide the author's bar inside an outer one.
    const { container } = render(
      <Wireframe mode="loading">
        <Typography tag="p" type="bodyLarge">
          <Skeleton lines={3} />
        </Typography>
      </Wireframe>,
    );
    expect(bars(container)).toHaveLength(3);
  });

  it("wireframes generic copy through Typography", () => {
    const { container } = render(
      <Wireframe>
        <Typography tag="p" type="bodyLarge">
          Post a shift
        </Typography>
      </Wireframe>,
    );
    expect(bars(container)).toHaveLength(1);
  });
});

describe("Wireframe interaction and semantics", () => {
  it("is inert and hidden from assistive tech by default — decorative demo furniture", () => {
    const { container } = render(
      <Wireframe>
        <TextInput label="Shift role" />
      </Wireframe>,
    );
    const scope = container.firstElementChild as HTMLElement;
    expect(scope.hasAttribute("inert")).toBe(true);
    expect(scope.getAttribute("aria-hidden")).toBe("true");
  });

  it("stays live and unhidden when interactive", () => {
    const { container } = render(
      <Wireframe interactive>
        <Field>
          <Checkbox />
          <Field.Label>Recurring shift</Field.Label>
        </Field>
      </Wireframe>,
    );
    const scope = container.firstElementChild as HTMLElement;
    expect(scope.hasAttribute("inert")).toBe(false);
    expect(scope.getAttribute("aria-hidden")).toBeNull();

    const box = screen.getByRole("checkbox");
    fireEvent.click(box);
    expect(box.getAttribute("aria-checked")).toBe("true");
  });

  it("announces a loading scope as busy rather than hiding it", () => {
    const { container } = render(
      <Wireframe mode="loading">
        <TextInput label="Shift role" />
      </Wireframe>,
    );
    const scope = container.firstElementChild as HTMLElement;
    expect(scope.getAttribute("aria-busy")).toBe("true");
    expect(scope.getAttribute("aria-hidden")).toBeNull();
    expect(scope.hasAttribute("inert")).toBe(true);
  });

  it("leaves a placeholder scope unmarked as busy", () => {
    const { container } = render(
      <Wireframe>
        <TextInput label="Shift role" />
      </Wireframe>,
    );
    expect(
      (container.firstElementChild as HTMLElement).getAttribute("aria-busy"),
    ).toBeNull();
  });
});

describe("Wireframe opacity", () => {
  const scopeOf = (c: HTMLElement) => c.firstElementChild as HTMLElement;

  it("recedes to 50% by default", () => {
    const { container } = render(
      <Wireframe>
        <TextInput label="Shift role" />
      </Wireframe>,
    );
    expect(scopeOf(container).className).toContain("opacity_50");
  });

  it("takes each of the four levels as a percentage", () => {
    for (const level of [25, 50, 75, 100] as const) {
      const { container, unmount } = render(
        <Wireframe opacity={level}>
          <TextInput label="Shift role" />
        </Wireframe>,
      );
      expect(scopeOf(container).className).toContain(`opacity_${level}`);
      unmount();
    }
  });

  it("applies to interactive and loading scopes too, not just dimmed placeholders", () => {
    const { container: interactive } = render(
      <Wireframe interactive opacity={100}>
        <TextInput label="Shift role" />
      </Wireframe>,
    );
    expect(scopeOf(interactive).className).toContain("opacity_100");

    const { container: loading } = render(
      <Wireframe mode="loading" opacity={75}>
        <TextInput label="Shift role" />
      </Wireframe>,
    );
    expect(scopeOf(loading).className).toContain("opacity_75");
  });

  it("carries no opacity class at all when disabled", () => {
    const { container } = render(
      <Wireframe enabled={false} opacity={25}>
        <TextInput label="Shift role" />
      </Wireframe>,
    );
    expect(scopeOf(container).className).not.toContain("opacity_");
  });
});

describe("useWireframe", () => {
  it("returns null outside a scope instead of throwing", () => {
    function Probe() {
      return <span>{String(useWireframe() === null)}</span>;
    }
    render(<Probe />);
    expect(screen.getByText("true")).toBeTruthy();
  });

  it("reports the active mode to consumers inside a scope", () => {
    function Probe() {
      return <span>{useWireframe()?.mode ?? "none"}</span>;
    }
    render(
      <Wireframe mode="loading">
        <Probe />
      </Wireframe>,
    );
    expect(screen.getByText("loading")).toBeTruthy();
  });
});
