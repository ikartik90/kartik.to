import { defineSemanticTokens } from "@pandacss/dev";

export const semanticTokens = defineSemanticTokens({
  opacity: {
    // The alpha `border.divider` is built from — 25% on a light ground,
    // 50% on a dark one — as a NUMBER, for the one place a hairline has
    // to be flattened onto the canvas as an opaque colour rather than
    // laid over it: the footer skyline, whose shared edges and crossing
    // ticks would otherwise stack darker. Change the two together.
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
      // A touch lighter than itemHover, so the message reads as inset
      // without competing with the fields around it (Figma 684:1045 dark
      // 20% / 704:1710 light 15%).
      notice: {
        value: {
          base: "color-mix(in srgb, var(--colors-neutral-500) 15%, transparent)",
          _dark:
            "color-mix(in srgb, var(--colors-neutral-500) 20%, transparent)",
        },
      },
      button: {
        secondary: {
          // Lighter in light UI — on a pale canvas the chip needs far
          // less alpha to read as a filled surface.
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
        // The secondary chip in the brand pigment — a button link set to
        // its accent (Figma 425:940/425:905). Same strengths as the
        // neutral chip in light UI, where the pink needs no more; in dark
        // UI the orange is already bright, so it stays at the light
        // strengths rather than the neutral's 25/50.
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
      // The chip behind a list marker's ink. Matches `surface` today but
      // kept separate: a dialog-surface retune should not resize the
      // contrast a 16px marker depends on.
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
      // `surface` at 75%, for a chip that floats ON an image rather than
      // on the app's own background — the collection's surplus badge. It
      // pairs with a backdrop blur: the translucency is what lets the
      // photo read through, and the blur is what keeps the label legible
      // over whatever happens to be under it (Figma 829:6913 light
      // rgba(216,221,227,.75) / 831:6972 dark rgba(46,51,56,.75) — the
      // same two neutrals `surface` resolves to).
      surfaceGlass: {
        value: {
          base: "color-mix(in srgb, var(--colors-neutral-200) 75%, transparent)",
          _dark:
            "color-mix(in srgb, var(--colors-neutral-800) 75%, transparent)",
        },
      },
      // `field.bg.default` composited over `surface` — one step up from
      // the surface, as ONE opaque colour. Written as the composite
      // rather than the hex so it tracks either half: dark is 25%
      // #576675 over #2E3338 = #384047 (Figma 723:2265, 1222:1902).
      //
      // Two surfaces need it flattened rather than layered, for the same
      // reason in two shapes: the calendar's edge scrims need a solid
      // gradient stop, and the icons bar's hint ledge is a tab standing
      // BESIDE its pill rather than on it, so it has nothing to take the
      // surface half from and the page would otherwise read through it.
      // It was `calendarScrim` while the calendar was the only caller.
      surfaceRaised: {
        value: {
          base: "color-mix(in srgb, var(--colors-neutral-500) 15%, var(--colors-neutral-200))",
          _dark:
            "color-mix(in srgb, var(--colors-neutral-500) 25%, var(--colors-neutral-800))",
        },
      },
      // The marquee drag band's fill — 5%, not the selected chip's 15%,
      // because it is laid OVER cells already painting their selection.
      calendarMarquee: {
        value: {
          base: "color-mix(in srgb, var(--colors-brand-pink) 5%, transparent)",
          _dark:
            "color-mix(in srgb, var(--colors-brand-orange) 5%, transparent)",
        },
      },
      // The band drawn BETWEEN the two ends of a range — the marquee's 5%
      // again, and for the same reason at the opposite end of the gesture:
      // this one is a wash the selected days are read ACROSS, so it has to
      // stay a third of the selected chip's 15% or the days between the
      // ends start reading as selected themselves. Named apart from the
      // marquee because they answer to different things — one is a
      // pointer's live extent, the other a settled selection — and a range
      // that had to move would drag the drag band with it.
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
      // A hairline needs more alpha to read on a dark ground than on a
      // light one, so it steps 25% → 50% exactly as `field.border.default`
      // does. Held to the SAME pair on purpose: the two are indistinguishable
      // in light UI, and a divider that stayed at 25% while every input
      // frame beside it went to 50% would read as a fainter class of rule
      // in dark only.
      divider: {
        value: {
          base: "color-mix(in srgb, var(--colors-neutral-500) 25%, transparent)",
          _dark:
            "color-mix(in srgb, var(--colors-neutral-500) 50%, transparent)",
        },
      },
      // 10% opacity inset outline for images (interface-design rule 11)
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

    // The text-input family, shared by every input that uses the same
    // frame. `active` is the brand hue, matching border.focusRing;
    // bg/border are translucent mixes so the frame reads as a subtle
    // fill (Figma 586:876).
    field: {
      bg: {
        // The neutral fill, and the one token in the family whose
        // strength depends on WHAT IT IS STANDING ON. 15% / 25% on the
        // canvas; `defaultOnSurface` below is the same fill five points
        // lighter, for a field on `bg.surface`.
        default: {
          value: {
            base: "color-mix(in srgb, var(--colors-neutral-500) 15%, transparent)",
            _dark:
              "color-mix(in srgb, var(--colors-neutral-500) 25%, transparent)",
          },
        },
        // `default` as a field wears it on `bg.surface`, which has
        // already spent a step of the same neutral getting away from the
        // canvas — a field taking its full share on top of that read as a
        // second panel rather than as an inset in one.
        //
        // A field cannot ask what is behind it, so the SURFACES say so:
        // anything painting `bg.surface` also writes
        // `--colors-field-bg-default: var(--colors-field-bg-default-on-surface)`,
        // and every field under it inherits the answer. It has to be the
        // token that is reassigned, not some flag the token reads: a
        // custom property's `var()`s are substituted where the property
        // is DECLARED — at `:root` — and what inherits down is the colour
        // that came out, so a flag set on a descendant would reach
        // nothing. Reassigning re-evaluates it at the surface instead.
        //
        // One line per surface and no theme numbers in it, which is why
        // this is a token and not a percentage written out a dozen times.
        //
        // `field.bg.hover` deliberately does NOT follow. Its invariant is
        // that a tertiary hover lands exactly on a secondary chip, and
        // both of those are 15% / 25% wherever they are; matching this
        // token was incidental. A field resting lighter than a row being
        // pointed at is right anyway.
        defaultOnSurface: {
          value: {
            base: "color-mix(in srgb, var(--colors-neutral-500) 10%, transparent)",
            _dark:
              "color-mix(in srgb, var(--colors-neutral-500) 20%, transparent)",
          },
        },
        // The settled brand — `rosemilk` in light, `rust` in dark, which
        // ARE the bright hue at 15% over the canvas (see the palette).
        // Named rather than re-mixed here, because the same paint is the
        // popover's surface below: a focused field and the popover it
        // opens are then one continuous surface rather than two brand
        // tints that nearly agree.
        //
        // Settled rather than translucent so a selection stops
        // COMPOUNDING: the range band lies under the days it spans, and a
        // veil-chip added its 15% to the band's 5%, reading stronger at
        // an end than at a day that merely started a run. The hue also
        // stops drifting with its ground — the same chip on a field
        // surface, under a marquee and on bare canvas used to be three
        // slightly different pinks.
        //
        // The cost is that it is canvas-bound: on a surface that is NOT
        // the canvas it reads as a plate rather than a tint. The right
        // trade for a selection, which should look the same wherever it
        // is made — but not for a veil that has to let its ground
        // through, which is why `activeVeil` exists below.
        active: {
          value: {
            base: "{colors.brand.rosemilk}",
            _dark: "{colors.brand.rust}",
          },
        },
        // `active`'s translucent twin, and the one place the veil IS the
        // point: the collection tile a drop is aimed at wears this over
        // its photo, which has to stay visible under it. An opaque wash
        // there would not mark the picture, it would replace it. Spelled
        // out rather than derived from the pigment, because what it needs
        // is the half of the recipe the pigment has already spent — the
        // brand at 15%, with nothing behind it.
        activeVeil: {
          value: {
            base: "color-mix(in srgb, var(--colors-brand-pink) 15%, transparent)",
            _dark:
              "color-mix(in srgb, var(--colors-brand-orange) 15%, transparent)",
          },
        },
        // Opaque, because the popover COVERS the field it belongs to and
        // so can't be translucent (Figma 631:894/631:898). The same
        // pigment as `active`, and kept as its own name all the same: a
        // surface and a chip answer to different things, and a popover
        // retune must not silently resize every selection in the system.
        popover: {
          value: {
            base: "{colors.brand.rosemilk}",
            _dark: "{colors.brand.rust}",
          },
        },
        // Selected chip inside that popover — neutral, so it reads
        // against the brand-tinted surface (Figma 563:2726/563:2767).
        selected: {
          value: {
            base: "color-mix(in srgb, var(--colors-neutral-600) 15%, transparent)",
            _dark:
              "color-mix(in srgb, var(--colors-neutral-400) 15%, transparent)",
          },
        },
        // The low-emphasis hover wash — option rows, icon buttons and
        // tertiary buttons all take it (`hoverBrand` is its onBrand twin;
        // Figma 647:2389, 629:1419). Deliberately the SAME value as
        // `bg.default` and `bg.button.secondary.default`, so a tertiary
        // hover lands exactly on the secondary chip; over a field surface
        // the two translucent layers stack and the row still lifts.
        hover: {
          value: {
            base: "color-mix(in srgb, var(--colors-neutral-500) 15%, transparent)",
            _dark:
              "color-mix(in srgb, var(--colors-neutral-500) 25%, transparent)",
          },
        },
        // The hover wash pressed one step further. An icon button's press
        // is a FILL rather than the shared `scale(0.97)`: a 28px chip
        // shrinks by 0.84px, which is nothing to see, while the 20px glyph
        // inside it lands its 1.25px strokes off-pixel and visibly wobbles
        // — the artifact costing more than the affordance was worth. A
        // 40px text chip is big enough for the scale to read, and keeps it.
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
        // One step fainter than `muted`, so an empty field reads as
        // unfilled without dragging labels/hints down with it.
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
