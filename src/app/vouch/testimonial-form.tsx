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

// The design system has no error colour; aria-invalid carries the state.
const errorTextStyle = css({ color: "field.text.default" });

// Off-screen, not display: none, or bots that skip hidden inputs skip the trap.
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
    setErrors((previous) =>
      previous[field] === undefined ? previous : { ...previous, [field]: undefined },
    );
  };

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isPending) return;

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
