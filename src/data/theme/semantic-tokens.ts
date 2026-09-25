import { defineSemanticTokens } from "@pandacss/dev";

export const semanticTokens = defineSemanticTokens({
  opacity: {
    // `border.divider`'s alpha as a number, for the skyline's flattened hairlines; change the two together.
    hairline: {
      value: {
        base: "0.25",
        _dark: "0.5",
      },
    },
  },
  colors: {
    bg: {
      canvas: {
        value: {
          base: "{colors.neutral.100}",
          _dark: "{colors.neutral.900}",
        },
      },
      itemHover: {
        value:
          "color-mix(in srgb, var(--colors-neutral-500) 25%, transparent)",
      },
      notice: {
        value: {
          base: "color-mix(in srgb, var(--colors-neutral-500) 15%, transparent)",
          _dark:
            "color-mix(in srgb, var(--colors-neutral-500) 20%, transparent)",
        },
      },
      button: {
        secondary: {
          default: {
            value: {
              base: "color-mix(in srgb, var(--colors-neutral-500) 15%, transparent)",
              _dark:
                "color-mix(in srgb, var(--colors-neutral-500) 25%, transparent)",
            },
          },
          hover: {
            value: {
              base: "color-mix(in srgb, var(--colors-neutral-500) 25%, transparent)",
              _dark:
                "color-mix(in srgb, var(--colors-neutral-500) 50%, transparent)",
            },
          },
        },
        accent: {
          default: {
            value: {
              base: "color-mix(in srgb, var(--colors-brand-pink) 15%, transparent)",
              _dark:
                "color-mix(in srgb, var(--colors-brand-orange) 15%, transparent)",
            },
          },
          hover: {
            value: {
              base: "color-mix(in srgb, var(--colors-brand-pink) 25%, transparent)",
              _dark:
                "color-mix(in srgb, var(--colors-brand-orange) 25%, transparent)",
            },
          },
        },
      },
      // Matches `surface` today, but separate so a surface retune cannot change a marker's contrast.
      listMarker: {
        value: {
          base: "{colors.neutral.200}",
          _dark: "{colors.neutral.800}",
        },
      },
      surface: {
        value: {
          base: "{colors.neutral.200}",
          _dark: "{colors.neutral.800}",
        },
      },
      // `surface` at 75%, for a chip over an image, paired with a backdrop blur.
      surfaceGlass: {
        value: {
          base: "color-mix(in srgb, var(--colors-neutral-200) 75%, transparent)",
          _dark:
            "color-mix(in srgb, var(--colors-neutral-800) 75%, transparent)",
        },
      },
      // `field.bg.default` flattened over `surface` as one opaque colour, for surfaces that cannot layer it.
      surfaceRaised: {
        value: {
          base: "color-mix(in srgb, var(--colors-neutral-500) 15%, var(--colors-neutral-200))",
          _dark:
            "color-mix(in srgb, var(--colors-neutral-500) 25%, var(--colors-neutral-800))",
        },
      },
      // 5%: it lies over cells already painting their selection.
      calendarMarquee: {
        value: {
          base: "color-mix(in srgb, var(--colors-brand-pink) 5%, transparent)",
          _dark:
            "color-mix(in srgb, var(--colors-brand-orange) 5%, transparent)",
        },
      },
      // A third of the chip's 15%, or the days between the ends read as selected.
      calendarRange: {
        value: {
          base: "color-mix(in srgb, var(--colors-brand-pink) 5%, transparent)",
          _dark:
            "color-mix(in srgb, var(--colors-brand-orange) 5%, transparent)",
        },
      },
      selection: {
        value: {
          base: "{colors.brand.orange}",
          _dark: "{colors.brand.pink}",
        },
      },
      // Prose highlight (<mark>) fill, paired with `text.highlight`.
      highlight: {
        value: {
          base: "color-mix(in srgb, var(--colors-brand-pink) 15%, transparent)",
          _dark:
            "color-mix(in srgb, var(--colors-brand-orange) 15%, transparent)",
        },
      },
      // Always a gradient — use with `background`, not `backgroundColor`
      brandedEmphasis: {
        value: {
          base: "linear-gradient(135deg, {colors.brand.orange} 0%, {colors.brand.pink} 60%)",
          _dark:
            "linear-gradient(135deg, {colors.brand.pink} 0%, {colors.brand.orange} 60%)",
        },
      },
    },

    text: {
      default: {
        value: {
          base: "{colors.neutral.700}",
          _dark: "{colors.neutral.200}",
        },
      },
      title: {
        value: {
          base: "{colors.neutral.900}",
          _dark: "{colors.neutral.100}",
        },
      },
      body: {
        value: {
          base: "{colors.neutral.500}",
          _dark: "{colors.neutral.400}",
        },
      },
      // Only readable over bg.brandedEmphasis (the gradient) — same in both themes
      brandedEmphasis: {
        value: "{colors.neutral.900}",
      },
      selection: {
        value: "{colors.neutral.900}",
      },
      highlight: {
        value: {
          base: "{colors.brand.pink}",
          _dark: "{colors.brand.orange}",
        },
      },
    },

    border: {
      // Steps 25% → 50% in lockstep with `field.border.default`.
      divider: {
        value: {
          base: "color-mix(in srgb, var(--colors-neutral-500) 25%, transparent)",
          _dark:
            "color-mix(in srgb, var(--colors-neutral-500) 50%, transparent)",
        },
      },
      imageOutline: {
        value: {
          base: "color-mix(in srgb, var(--colors-neutral-900) 10%, transparent)",
          _dark:
            "color-mix(in srgb, var(--colors-neutral-100) 10%, transparent)",
        },
      },
      focusRing: {
        value: {
          base: "{colors.brand.pink}",
          _dark: "{colors.brand.orange}",
        },
      },
    },

    logo: {
      default: {
        value: {
          base: "{colors.neutral.500}",
          _dark: "{colors.neutral.400}",
        },
      },
    },

    // The text-input family; `active` matches `border.focusRing`.
    field: {
      bg: {
        // Its strength depends on the ground; see `defaultOnSurface`.
        default: {
          value: {
            base: "color-mix(in srgb, var(--colors-neutral-500) 15%, transparent)",
            _dark:
              "color-mix(in srgb, var(--colors-neutral-500) 25%, transparent)",
          },
        },
        // Anything painting `bg.surface` reassigns `--colors-field-bg-default` to this. It must be the token that is
        // reassigned: var() resolves where declared (`:root`), so a flag set lower would reach nothing.
        defaultOnSurface: {
          value: {
            base: "color-mix(in srgb, var(--colors-neutral-500) 10%, transparent)",
            _dark:
              "color-mix(in srgb, var(--colors-neutral-500) 20%, transparent)",
          },
        },
        // Opaque, so a selection never compounds with the range band; `activeVeil` is the translucent twin.
        active: {
          value: {
            base: "{colors.brand.rosemilk}",
            _dark: "{colors.brand.rust}",
          },
        },
        // For a tile's photo, which must stay visible under the wash.
        activeVeil: {
          value: {
            base: "color-mix(in srgb, var(--colors-brand-pink) 15%, transparent)",
            _dark:
              "color-mix(in srgb, var(--colors-brand-orange) 15%, transparent)",
          },
        },
        // Opaque: the popover covers its field. Same pigment as `active`, named apart on purpose.
        popover: {
          value: {
            base: "{colors.brand.rosemilk}",
            _dark: "{colors.brand.rust}",
          },
        },
        // Neutral, so it reads against the brand-tinted popover.
        selected: {
          value: {
            base: "color-mix(in srgb, var(--colors-neutral-600) 15%, transparent)",
            _dark:
              "color-mix(in srgb, var(--colors-neutral-400) 15%, transparent)",
          },
        },
        // Deliberately equal to `default` and the secondary chip, so a tertiary hover lands exactly on it.
        hover: {
          value: {
            base: "color-mix(in srgb, var(--colors-neutral-500) 15%, transparent)",
            _dark:
              "color-mix(in srgb, var(--colors-neutral-500) 25%, transparent)",
          },
        },
        // An icon button's press is a fill, not `scale(0.97)`, which wobbles a 20px glyph off-pixel.
        pressed: {
          value: {
            base: "color-mix(in srgb, var(--colors-neutral-500) 25%, transparent)",
            _dark:
              "color-mix(in srgb, var(--colors-neutral-500) 40%, transparent)",
          },
        },
        hoverBrand: {
          value: {
            base: "color-mix(in srgb, var(--colors-brand-pink) 10%, transparent)",
            _dark:
              "color-mix(in srgb, var(--colors-brand-orange) 5%, transparent)",
          },
        },
      },
      border: {
        default: {
          value: {
            base: "color-mix(in srgb, var(--colors-neutral-500) 25%, transparent)",
            _dark:
              "color-mix(in srgb, var(--colors-neutral-500) 50%, transparent)",
          },
        },
        active: {
          value: {
            base: "color-mix(in srgb, var(--colors-brand-pink) 25%, transparent)",
            _dark:
              "color-mix(in srgb, var(--colors-brand-orange) 25%, transparent)",
          },
        },
      },
      text: {
        // Resting value + leading icon.
        default: {
          value: {
            base: "{colors.neutral.600}",
            _dark: "{colors.neutral.400}",
          },
        },
        // Resting label + hint (value @ 50%).
        muted: {
          value: {
            base: "color-mix(in srgb, var(--colors-neutral-600) 50%, var(--colors-neutral-200))",
            _dark:
              "color-mix(in srgb, var(--colors-neutral-400) 50%, var(--colors-neutral-800))",
          },
        },
        // One step fainter than `muted`.
        placeholder: {
          value: {
            base: "color-mix(in srgb, var(--colors-neutral-600) 25%, transparent)",
            _dark:
              "color-mix(in srgb, var(--colors-neutral-400) 25%, transparent)",
          },
        },
        // Active label / value / leading icon accent.
        active: {
          value: {
            base: "{colors.brand.pink}",
            _dark: "{colors.brand.orange}",
          },
        },
        // `placeholder`'s counterpart on a brand-tinted surface.
        activeMuted: {
          value: {
            base: "color-mix(in srgb, var(--colors-brand-pink) 25%, transparent)",
            _dark:
              "color-mix(in srgb, var(--colors-brand-orange) 25%, transparent)",
          },
        },
      },
    },
  },
});
