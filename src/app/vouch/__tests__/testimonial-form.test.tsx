import { render, screen, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockSubmit = vi.fn();

vi.mock("@/app/actions/testimonial", () => ({
  submitTestimonial: (...args: unknown[]) => mockSubmit(...args),
}));

import { TestimonialForm } from "../testimonial-form";
import {
  TESTIMONIAL_QUOTE_MAX_LENGTH,
  TESTIMONIAL_HONEYPOT_FIELD,
} from "@/domain/testimonial";

afterEach(() => cleanup());

beforeEach(() => {
  vi.clearAllMocks();
  mockSubmit.mockResolvedValue({ ok: true });
});

const name = () => screen.getByLabelText(/your name/i);
const quote = () => screen.getByLabelText(/testimonial/i);
const send = () => screen.getByRole("button", { name: /send/i });

async function fillIn(user: ReturnType<typeof userEvent.setup>) {
  await user.type(name(), "Ada Lovelace");
  await user.type(quote(), "Shipped it, on time, and it was beautiful.");
}

describe("TestimonialForm", () => {
  it("hands both fields to the action", async () => {
    const user = userEvent.setup();
    render(<TestimonialForm />);

    await fillIn(user);
    await user.click(send());

    await waitFor(() => expect(mockSubmit).toHaveBeenCalledTimes(1));
    expect(mockSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Ada Lovelace",
        quote: "Shipped it, on time, and it was beautiful.",
      }),
    );
  });

  // The cap is the brief, so it has to be visible while writing rather than
  // discovered on submit. Counted down, because what a writer wants to know is
  // how much room is left, not how much they have used.
  it("counts down the characters left as you type", async () => {
    const user = userEvent.setup();
    render(<TestimonialForm />);

    expect(
      screen.getByText(String(TESTIMONIAL_QUOTE_MAX_LENGTH), { exact: false }),
    ).toBeTruthy();

    await user.type(quote(), "Twelve chars");
    expect(
      screen.getByText(String(TESTIMONIAL_QUOTE_MAX_LENGTH - 12), {
        exact: false,
      }),
    ).toBeTruthy();
  });

  // Belt and braces with the schema's own cap: the box refuses the 281st
  // character rather than letting it be typed and then refused on send.
  it("stops the box at the maximum length", () => {
    render(<TestimonialForm />);
    expect((quote() as HTMLTextAreaElement).maxLength).toBe(
      TESTIMONIAL_QUOTE_MAX_LENGTH,
    );
  });

  // The form is gone once it has been sent. Leaving it on screen invites a
  // second send, and the person has no way to tell the first one landed.
  it("thanks them and retires the form once it lands", async () => {
    const user = userEvent.setup();
    render(<TestimonialForm />);

    await fillIn(user);
    await user.click(send());

    await waitFor(() => expect(screen.queryByLabelText(/your name/i)).toBeNull());
    expect(screen.getByRole("status").textContent).toMatch(/thank/i);
  });

  // A refusal has to land UNDER the box it belongs to, and everything typed has
  // to survive it — retyping a testimonial because one URL was wrong is how you
  // lose the testimonial.
  it("shows a refusal under its own field and keeps what was typed", async () => {
    const user = userEvent.setup();
    mockSubmit.mockResolvedValue({
      ok: false,
      errors: { name: "That name is too long." },
    });
    render(<TestimonialForm />);

    await fillIn(user);
    await user.click(send());

    await waitFor(() =>
      expect(screen.getByText("That name is too long.")).toBeTruthy(),
    );
    // Nothing typed is lost to a refusal — retyping a testimonial because one
    // field was wrong is how you lose the testimonial.
    expect((quote() as HTMLTextAreaElement).value).toBe(
      "Shipped it, on time, and it was beautiful.",
    );

    const described = name().getAttribute("aria-describedby");
    expect(described).toBeTruthy();
    expect(document.getElementById(described!)?.textContent).toBe(
      "That name is too long.",
    );
    expect(name().getAttribute("aria-invalid")).toBe("true");
  });

  // The field was removed on 2026-09-10. A stale build that still rendered it
  // would collect a value nothing stores, so its absence is worth asserting
  // rather than assuming.
  it("offers no LinkedIn field", () => {
    render(<TestimonialForm />);
    expect(screen.queryByLabelText(/linkedin/i)).toBeNull();
    expect(screen.getAllByRole("textbox")).toHaveLength(2);
  });

  // A failure that belongs to no field still has to be said out loud.
  it("shows a whole-form failure", async () => {
    const user = userEvent.setup();
    mockSubmit.mockResolvedValue({
      ok: false,
      errors: { form: "Something went wrong saving that. Try again?" },
    });
    render(<TestimonialForm />);

    await fillIn(user);
    await user.click(send());

    await waitFor(() =>
      expect(
        screen.getByText("Something went wrong saving that. Try again?"),
      ).toBeTruthy(),
    );
    expect(screen.getByLabelText(/your name/i)).toBeTruthy();
  });

  // Double-click, slow connection, same result: one row.
  it("refuses a second send while the first is in flight", async () => {
    const user = userEvent.setup();
    let release: (value: { ok: true }) => void = () => {};
    mockSubmit.mockReturnValue(
      new Promise<{ ok: true }>((resolve) => {
        release = resolve;
      }),
    );
    render(<TestimonialForm />);

    await fillIn(user);
    await user.click(send());
    await waitFor(() =>
      expect((send() as HTMLButtonElement).disabled).toBe(true),
    );
    await user.click(send());

    expect(mockSubmit).toHaveBeenCalledTimes(1);
    release({ ok: true });
  });

  // Hidden from EYES and from assistive tech — a screen reader reaching a field
  // it is meant to leave blank is a trap for the wrong person.
  it("carries a honeypot no human is offered", () => {
    const { container } = render(<TestimonialForm />);
    const trap = container.querySelector(
      `[name="${TESTIMONIAL_HONEYPOT_FIELD}"]`,
    ) as HTMLInputElement | null;

    expect(trap).toBeTruthy();
    expect(trap!.getAttribute("aria-hidden")).toBe("true");
    expect(trap!.tabIndex).toBe(-1);
    expect(trap!.autocomplete).toBe("off");
  });
});
