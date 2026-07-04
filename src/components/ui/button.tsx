"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cx } from "../../../styled-system/css";
import { buttonRecipe, type ButtonVariant } from "./button-recipe";

export type { ButtonVariant };
export { buttonRecipe };

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button({ variant, className, type = "button", ...rest }, ref) {
    return (
      <button
        ref={ref}
        type={type}
        className={cx(buttonRecipe({ variant }), className)}
        {...rest}
      />
    );
  },
);
