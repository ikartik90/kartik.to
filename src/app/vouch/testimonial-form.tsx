"use client";

import { useState, useTransition } from "react";
import { css } from "../../../styled-system/css";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { TextInput } from "@/components/ui/input/text-input";
import { TextArea } from "@/components/ui/input/text-area";
import {
  TESTIMONIAL_HONEYPOT_FIELD,
  TESTIMONIAL_NAME_MAX_LENGTH,
  TESTIMONIAL_QUOTE_MAX_LENGTH,
} from "@/domain/testimonial";
import {
  submitTestimonial,
  type TestimonialFieldErrors,
} from "@/app/actions/testimonial";

// ---------------------------------------------------------------------------
// The form itself — three boxes and a button, for somebody who is doing me a
// favour and did not ask to be here.
//
// LOCAL to `/vouch` rather than in the global library, per the two-page rule:
// there is exactly one page that collects testimonials, and there is no second
// caller to generalise for. It leans entirely on shared primitives — Field,
// Button, Notice — so the only thing local about it is the arrangement.
//
// Every refusal that can be shown IN PLACE is shown in place. The one thing
// this page must not do is lose what somebody wrote, so state lives here and
// survives every refusal; the fields are only cleared by succeeding.
//
// TWO fields, and it briefly had three. The LinkedIn URL is gone, which also
// took the unique key that let a second send correct the first — so nothing on
// this page offers to edit a testimonial after it has landed, and the copy above
// no longer promises it.
// ---------------------------------------------------------------------------

const formStyle = css({
  display: "flex",
  flexDirection: "column",
  gap: "xl",
  width: "token(spacing.full)",
});

const footerStyle = css({
  display: "flex",
  justifyContent: "flex-end",
});

// NOT a red, because this design system has no error colour and inventing one
// here would be a design decision smuggled in through a form. A refusal is set
// in the field's full-strength text instead of the hint's muted tone, so it
// reads as a statement rather than a whisper, and `aria-invalid` on the control
// is what actually carries the state to anyone not reading the colour.
const errorTextStyle = css({ color: "field.text.default" });

// Off-screen rather than `display: none`: a bot that skips undisplayed inputs
// skips the trap, and the trap is the point. Out of the tab order and out of
// the accessibility tree, so no human — sighted, keyboard or screen reader —
// is ever offered it.
const honeypotStyle = css({
  position: "absolute",
  width: "1px",
  height: "1px",
  padding: "none",
  margin: "-1px",
  overflow: "hidden",
  clipPath: "inset(50%)",
  whiteSpace: "nowrap",
  border: "none",
});

const EMPTY = { name: "", quote: "" };

export function TestimonialForm() {
  const [values, setValues] = useState(EMPTY);
  const [errors, setErrors] = useState<TestimonialFieldErrors>({});
  const [sent, setSent] = useState(false);
  const [isPending, startTransition] = useTransition();

  const remaining = TESTIMONIAL_QUOTE_MAX_LENGTH - values.quote.length;

  const set = (field: keyof typeof EMPTY) => (value: string) => {
    setValues((previous) => ({ ...previous, [field]: value }));
    // The refusal under a box stops being true the moment the box changes.
    // Clearing on edit rather than on the next send means the correction feels
    // accepted as it is typed.
    setErrors((previous) =>
      previous[field] === undefined ? previous : { ...previous, [field]: undefined },
    );
  };

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isPending) return;

    // Read from the DOM rather than from state, because the honeypot is
    // deliberately uncontrolled — nothing in this component should have an
    // opinion about a field no human fills in.
    const trap = new FormData(event.currentTarget).get(
      TESTIMONIAL_HONEYPOT_FIELD,
    );

    startTransition(async () => {
      const result = await submitTestimonial({
        ...values,
        website: typeof trap === "string" ? trap : "",
      });

      if (result.ok) {
        setSent(true);
        return;
      }
      setErrors(result.errors);
    });
  }

  // The form is RETIRED once it lands, rather than cleared and left standing.
  // A blank form after a send reads as "that didn't work, do it again", which
  // is the one misreading worth spending a state on preventing.
  if (sent) {
    return (
      <Notice role="status">
        <Notice.Label>
          <strong>Thank you.</strong> That&rsquo;s landed — I really appreciate
          you taking the time.
        </Notice.Label>
      </Notice>
    );
  }

  return (
    <form className={formStyle} onSubmit={handleSubmit} noValidate>
      <TextInput
        label="Your name"
        value={values.name}
        maxLength={TESTIMONIAL_NAME_MAX_LENGTH}
        autoComplete="name"
        aria-invalid={errors.name ? true : undefined}
        hint={
          errors.name ? (
            <span className={errorTextStyle}>{errors.name}</span>
          ) : (
            "However you'd like to be credited."
          )
        }
        onChange={(event) => set("name")(event.target.value)}
      />


      <TextArea
        label="Testimonial"
        value={values.quote}
        rows={4}
        // The same number the schema enforces, so the box cannot let through
        // what the column refuses — and the refusal arrives as a key that does
        // nothing rather than as an error after the fact.
        maxLength={TESTIMONIAL_QUOTE_MAX_LENGTH}
        aria-invalid={errors.quote ? true : undefined}
        hint={
          errors.quote ? (
            <span className={errorTextStyle}>{errors.quote}</span>
          ) : (
            `${remaining} characters left`
          )
        }
        onChange={(event) => set("quote")(event.target.value)}
      />

      {/* See `TESTIMONIAL_HONEYPOT_FIELD`. Uncontrolled on purpose. */}
      <input
        type="text"
        name={TESTIMONIAL_HONEYPOT_FIELD}
        className={honeypotStyle}
        tabIndex={-1}
        aria-hidden="true"
        autoComplete="off"
        defaultValue=""
      />

      {errors.form && (
        <Notice role="alert">
          <Notice.Label>{errors.form}</Notice.Label>
        </Notice>
      )}

      <footer className={footerStyle}>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Sending…" : "Send it"}
        </Button>
      </footer>
    </form>
  );
}
