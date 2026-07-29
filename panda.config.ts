import { defineConfig, defineRecipe, defineSlotRecipe } from "@pandacss/dev";

export default defineConfig({
  presets: [],
  preflight: true,

  include: ["./src/**/*.{js,jsx,ts,tsx}", "./pages/**/*.{js,jsx,ts,tsx}"],
  exclude: [],

  conditions: {
    extend: {
      // @starting-style is not a built-in Panda condition — defined here for transition entry states
      starting: "@starting-style",
      // Extend default `dark` to also respond to [data-theme="dark"] on <html>
      dark: '.dark &, [data-theme="dark"] &',
      demoFrameNarrow: "@container demoFrame (max-width: 760px)",
      demoFrameCompact: "@container demoFrame (max-width: 535px)",
    },
  },

  theme: {
    // Replace default breakpoints with design system breakpoints (mobile-first)
    breakpoints: {
      md: "820px",
      lg: "1200px",
    },

    extend: {
      tokens: {
        sizes: {
          // Text column width — prose elements inside <article> are capped here
          articleContent: { value: "640px" },
          dialogSm: { value: "480px" },
          listingCardWidth: { value: "304px" },
          articleShowcase: { value: "960px" },
          calchemyDemo: { value: "720px" },
          librarySidebar: { value: "200px" },
          imagePreviewMax: { value: "280px" },
          insertDialogHeight: { value: "480px" },
          dialogFooter: { value: "52px" },
          quoteMark: { value: "52px" },
          tooltipIcon: { value: "14px" },
          // Numbered-list ordinal badge — square at single digit, pill beyond (Figma 413:684/688)
          listMarker: { value: "24px" },
          // Calendar day cell — also the weekday header cell and the month
          // chevrons, so the whole grid keeps one column pitch (Figma 563:3377).
          calendarDay: { value: "24px" },
          // Option list / combobox popover width. Fixed like the calendar's
          // 208px pitch so a select popover and a date popover read as siblings
          // (Figma 647:2383 option-list, 629:1416 combobox popover).
          optionListWidth: { value: "208px" },
          // One option row — the list-item hit target (24px line + 2×4 inset),
          // also the empty-state row height (Figma 647:2387).
          optionRow: { value: "32px" },
          // Bulleted-list dot diameter
          listBullet: { value: "8px" },
          // Selection toolbar icon button (Figma 422:834 — 28px square)
          toolbarButton: { value: "28px" },
          // Margin-note card in the aside column, and its offset to the right of
          // the annotated text (per spec: 100px right of the text content).
          sidenoteWidth: { value: "320px" },
          sidenoteOffset: { value: "100px" },
          // Centred (stacked) fallback: content-column width minus this inset,
          // floored at the min width.
          sidenoteStackedInset: { value: "80px" },
          sidenoteMinWidth: { value: "320px" },
          sidenoteMaxWidth: { value: "480px" },
        },

        colors: {
          neutral: {
            100: { value: "#EEF2F6" },
            200: { value: "#D8DDE3" },
            300: { value: "#C3CDD7" },
            400: { value: "#A9BFD6" },
            500: { value: "#576675" },
            600: { value: "#414244" },
            700: { value: "#384047" },
            800: { value: "#2E3338" },
            900: { value: "#1F2123" },
          },
          brand: {
            rust: { value: "#41362E" },
            orange: { value: "#FFAB6F" },
            rosemilk: { value: "#F2C9DE" },
            pink: { value: "#FF4D97" },
          },
        },

        fonts: {
          switzer: {
            value: "var(--font-switzer), Helvetica, sans-serif",
          },
          jetbrainsMono: {
            value: "var(--font-jetbrains-mono), ui-monospace, monospace",
          },
        },

        fontWeights: {
          base: { value: "400" },
          medium: { value: "500" },
          bold: { value: "550" },
        },

        // Named spacing scale — used for padding, margin, gap, border-radius, border-width
        spacing: {
          none: { value: "0px" },
          "3xs": { value: "0.5px" },
          xxs: { value: "1px" },
          xs: { value: "2px" },
          sm: { value: "4px" },
          md: { value: "8px" },
          lg: { value: "12px" },
          xl: { value: "16px" },
          xxl: { value: "20px" },
          "3xl": { value: "32px" },
          "4xl": { value: "40px" },
          "5xl": { value: "80px" },
          half: { value: "50%" },
          full: { value: "100%" },
        },

        // Border-radius scale — values mirror spacing for concentric radius compliance
        radii: {
          sm: { value: "{spacing.sm}" },
          md: { value: "{spacing.md}" },
          lg: { value: "{spacing.lg}" },
          xl: { value: "{spacing.xl}" },
        },
      },

      containerNames: ["demoFrame"],

      semanticTokens: {
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
            // Notice callout fill — a subtle neutral wash a touch lighter than
            // itemHover so the message reads as inset without competing with the
            // field surfaces around it (Figma 684:1045 dark 20% / 704:1710 light 15%).
            notice: {
              value: {
                base: "color-mix(in srgb, var(--colors-neutral-500) 15%, transparent)",
                _dark:
                  "color-mix(in srgb, var(--colors-neutral-500) 20%, transparent)",
              },
            },
            button: {
              secondary: {
                // The same neutral wash in both themes, but lighter in light UI
                // — on a pale canvas the chip needs far less alpha to read as a
                // filled surface than it does against the dark one.
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
            },
            // One step elevated from canvas — used for dialog/surface backgrounds
            surface: {
              value: {
                base: "{colors.neutral.200}",
                _dark: "{colors.neutral.800}",
              },
            },
            selection: {
              value: {
                base: "{colors.brand.orange}",
                _dark: "{colors.brand.pink}",
              },
            },
            // Always a gradient — use with `background`, not `backgroundColor`
            brandedEmphasis: {
              value: {
                base: "linear-gradient(135deg, {colors.brand.orange} 0%, {colors.brand.pink} 60%)",
                _dark:
                  "linear-gradient(135deg, {colors.brand.pink} 40%, {colors.brand.orange} 100%)",
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
            // Numbered-list ordinal digits over the gradient badge — inverted per
            // theme (light digits in light UI, dark digits in dark UI) per Figma.
            listMarker: {
              value: {
                base: "{colors.neutral.100}",
                _dark: "{colors.neutral.900}",
              },
            },
            selection: {
              value: "{colors.neutral.900}",
            },
          },

          border: {
            divider: {
              value:
                "color-mix(in srgb, var(--colors-neutral-500) 25%, transparent)",
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

          // Text-input family (TextInput, and the forthcoming Select/Date inputs
          // that share the same frame). Resting greys are neutral.600 (light) /
          // neutral.400 (dark); the `active` accent is the brand hue — pink in
          // light, orange in dark, matching border.focusRing. bg/border are
          // translucent mixes so the frame reads as a subtle fill (Figma 586:876).
          field: {
            bg: {
              default: {
                value: {
                  base: "color-mix(in srgb, var(--colors-neutral-500) 15%, transparent)",
                  _dark:
                    "color-mix(in srgb, var(--colors-neutral-500) 25%, transparent)",
                },
              },
              active: {
                value: {
                  base: "color-mix(in srgb, var(--colors-brand-pink) 15%, transparent)",
                  _dark:
                    "color-mix(in srgb, var(--colors-brand-orange) 15%, transparent)",
                },
              },
              // Opaque covering surface for the Date input's calendar popover —
              // it sits over the field, so it can't be translucent like `active`
              // (Figma 631:894 dark / 631:898 light).
              popover: {
                value: { base: "#f2c9de", _dark: "#41362e" },
              },
              // Selected chip inside that popover — the resting text colour at
              // 15%, so it reads neutral against the brand-tinted surface
              // (Figma 563:2726 dark / 563:2767 light).
              selected: {
                value: {
                  base: "color-mix(in srgb, var(--colors-neutral-600) 15%, transparent)",
                  _dark:
                    "color-mix(in srgb, var(--colors-neutral-400) 15%, transparent)",
                },
              },
              // The low-emphasis hover wash, shared by hovered/keyboard-active
              // option rows, icon buttons and tertiary buttons — so all three
              // respond identically (`hoverBrand` is its onBrand twin; Figma
              // 647:2389 default, 629:1419 onBrand).
              //
              // Deliberately the SAME value as `bg.default` above and
              // `bg.button.secondary.default` in both themes, so hovering a
              // tertiary button lands exactly on the secondary chip. Where this
              // wash layers over a field surface (an option row on a
              // `bg.default` list) the two translucent layers stack, so the
              // hovered row still lifts clear of the list it sits in.
              hover: {
                value: {
                  base: "color-mix(in srgb, var(--colors-neutral-500) 15%, transparent)",
                  _dark:
                    "color-mix(in srgb, var(--colors-neutral-500) 25%, transparent)",
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
                  base: "color-mix(in srgb, var(--colors-neutral-600) 50%, transparent)",
                  _dark:
                    "color-mix(in srgb, var(--colors-neutral-400) 50%, transparent)",
                },
              },
              // Placeholder text — the neutral accent at 25%, one step fainter
              // than `muted` so an empty field reads as clearly unfilled without
              // dragging labels/hints (which stay `muted`) down with it. The
              // brand-surface counterpart is `activeMuted` (also 25%).
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
              // Secondary/placeholder text on a brand-tinted surface — the
              // active accent dialled back to 25% (the brand-surface counterpart
              // of `muted`, e.g. the Date popover search placeholder).
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
      },

      recipes: {
        action: defineRecipe({
          className: "action",
          description:
            "The one look shared by the two actionable primitives — Button (a <button> that ACTS) and Link (an <a>/next-link that NAVIGATES) — so their skin lives in the design system once and both consume it. `text` = the standalone CTA (filled secondary chip, 8px radius, fixed 40px height, hugs content with an 80px floor); `icon` = the compact 28px toolbar chip (`color: inherit` so the surface owns the glyph hue — the calendar chevrons and their onBrand retint); `link` = an inline underlined text link. Orthogonal to that shape axis, `emphasis` sets the fill prominence: `secondary` (the filled chip drawn above) or `tertiary` (no fill at rest, the neutral `field.bg.hover` on hover — the same wash icon buttons use). Icon buttons are tertiary by nature.",
          base: {
            cursor: "pointer",
            border: "none",
            appearance: "none",
            textDecoration: "none",
            // Hug the content — never stretch to fill. A flex item's display is
            // blockified (inline-flex → flex), so a flex-column / grid parent's
            // default `stretch` would otherwise pull the control across the cross
            // axis; a definite `fit-content` width opts out. Ignored by `link`.
            width: "fit-content",
            transition:
              "transform 100ms ease, background-color 150ms ease, color 150ms ease",
            _active: { transform: "scale(0.97)" },
            _disabled: {
              opacity: 0.5,
              cursor: "not-allowed",
              pointerEvents: "none",
            },
            // Composed icons track the resolved text colour and hold a 20px box.
            "& svg": {
              width: "token(spacing.xxl)",
              height: "token(spacing.xxl)",
              flexShrink: 0,
              display: "block",
            },
            "& svg path[stroke]": { stroke: "currentColor" },
            "& svg path[fill]": { fill: "currentColor" },
          },
          variants: {
            variant: {
              text: {
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                // Space a leading icon from the label when both compose.
                gap: "md",
                height: "token(spacing.4xl)",
                // Floor a short label (Cancel / OK) to a substantial chip; a
                // longer label grows past it since the width is fit-content.
                minWidth: "token(spacing.5xl)",
                paddingInline: "lg",
                borderRadius: "md",
                backgroundColor: "bg.button.secondary.default",
                color: "text.body",
                textStyle: "bodyLarge",
                _hover: { backgroundColor: "bg.button.secondary.hover" },
              },
              icon: {
                position: "relative",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                // Space icon ∣ optional label (the ← Home link) the way the
                // toolbar chip spaces its glyph and text.
                gap: "sm",
                padding: "sm",
                borderRadius: "sm",
                color: "inherit",
                // Matches the toolbar chip for the icon+label case; harmless
                // for the icon-only majority.
                textStyle: "bodySmall",
                backgroundColor: "transparent",
                _hover: { backgroundColor: "field.bg.hover" },
                "html[data-keyboard-focus] &:focus-visible": {
                  boxShadow:
                    "inset 0 0 0 1.5px var(--colors-border-focus-ring)",
                },
              },
              link: {
                display: "inline",
                padding: "none",
                background: "none",
                color: { base: "brand.pink", _dark: "brand.orange" },
                textStyle: "bodySmall",
                textDecoration: "underline",
                textUnderlineOffset: "3px",
                verticalAlign: "baseline",
                _active: { transform: "none" },
              },
            },
            // Fill prominence — orthogonal to `variant` (which is the shape).
            // `secondary` is the filled chip the `text` variant already draws;
            // `tertiary` drops the resting fill and hovers to the neutral
            // `field.bg.hover` (see compoundVariants) — the same low-emphasis
            // wash icon buttons use. Icon buttons are tertiary by nature —
            // their transparent rest state and `field.bg.hover` live in the
            // `icon` variant, so emphasis is inert for them.
            emphasis: {
              secondary: {},
              tertiary: {},
            },
          },
          compoundVariants: [
            {
              variant: "text",
              emphasis: "tertiary",
              // No resting fill, and hover to the neutral `field.bg.hover` — the
              // same low-emphasis wash icon buttons use — overriding the
              // secondary hover the `text` variant otherwise supplies. Both land
              // as atomic utilities (later cascade layer), so they win over the
              // `text` variant's own fill.
              css: {
                backgroundColor: "transparent",
                _hover: { backgroundColor: "field.bg.hover" },
              },
            },
          ],
          defaultVariants: { variant: "text", emphasis: "secondary" },
          // Button/Link call action({ variant, emphasis }) with runtime values,
          // so every combination must be emitted statically.
          staticCss: [{ variant: ["*"], emphasis: ["*"] }],
        }),

        inlineCode: defineRecipe({
          className: "inline-code",
          description: "Inline code mark inside article prose.",
          base: {
            textStyle: "inlineCode",
            background: "bg.surface",
            paddingInline: "sm",
            paddingBlock: "xs",
            borderRadius: "sm",
          },
        }),

        articleLink: defineRecipe({
          className: "article-link",
          description:
            "Hyperlink inside article prose. The underline is drawn as two stacked background bars, not text-decoration, so the hover state can be the brand gradient (text-decoration-color can't be a gradient): a neutral color-mix bar (text.body @ 50%) with the brandedEmphasis gradient layered on top, hidden at rest and grown in on hover. box-decoration-break:clone repeats the bars on each line of a wrapped link.",
          base: {
            // No text-decoration at all — the underline is the background bars
            // below; textDecorationLine:none suppresses the browser's default
            // <a> underline.
            textDecorationLine: "none",
            color: "text.default",
            paddingBottom: "xs",
            backgroundImage:
              "token(colors.bg.brandedEmphasis), linear-gradient(color-mix(in srgb, var(--colors-text-body) 50%, transparent), color-mix(in srgb, var(--colors-text-body) 50%, transparent))",
            backgroundRepeat: "no-repeat",
            // Anchored to the bottom of the padding box (2px below the line box)
            // so the gradient grows upward to exactly cover the neutral bar on
            // hover. 1px thick (spacing.xxs).
            backgroundPosition: "0 100%",
            backgroundSize: "100% 0, 100% token(spacing.xxs)",
            WebkitBoxDecorationBreak: "clone",
            boxDecorationBreak: "clone",
            transition: "color 150ms ease, background-size 150ms ease",
            _hover: {
              color: "text.title",
              backgroundSize:
                "100% token(spacing.xxs), 100% token(spacing.xxs)",
            },
          },
        }),

        articleUnderline: defineRecipe({
          className: "article-underline",
          description: "Solid underline mark inside article prose.",
          base: {
            textDecorationLine: "underline",
            textDecorationStyle: "solid",
            textUnderlineOffset: "0.15em",
          },
        }),

        articleStrikethrough: defineRecipe({
          className: "article-strikethrough",
          description: "Strikethrough mark inside article prose.",
          base: {
            textDecorationLine: "line-through",
          },
        }),

        articleHighlight: defineRecipe({
          className: "article-highlight",
          description:
            "Highlight mark (<mark>) inside article prose — brand gradient behind fixed neutral.600 text.",
          base: {
            background: "bg.brandedEmphasis",
            color: "neutral.900",
            paddingInline: "xxs",
            paddingBlock: "xxs",
            boxDecorationBreak: "clone",
            WebkitBoxDecorationBreak: "clone",
            // Keep nested marks on the highlight's own colour (see self-improvement.md).
            "& :is(strong, b, em, i, u, s, code, a)": {
              color: "inherit",
            },
          },
        }),

        articleSidenote: defineRecipe({
          className: "article-sidenote",
          description:
            "Sidenote annotation mark — the annotated run of prose. A dotted underline signals the margin note; the run also carries an `anchor-name` (set inline, per note) the aside card positions against.",
          base: {
            textDecorationLine: "underline",
            textDecorationStyle: "dotted",
            textDecorationColor:
              "color-mix(in srgb, var(--colors-text-body) 50%, transparent)",
            textDecorationThickness: "token(spacing.xxs)",
            textUnderlineOffset: "token(spacing.xs)",
            cursor: "default",
            // Nested marks keep their own colour; only the underline is added.
            "& :is(strong, b, em, i, u, s, code, a)": { color: "inherit" },
          },
        }),

        articleSidenoteRef: defineRecipe({
          className: "article-sidenote-ref",
          description:
            "Superscript ordinal after an annotated run. The digit is read from the `data-sidenote-number` attribute — assigned from the AST-derived ordinal (see collectSidenotes / SidenoteLayer + the reader). A CSS counter was avoided because Chromium doesn't re-resolve `counter()` generated content when a preceding counter-incrementing element is removed, so ordinals wouldn't decrement live. Painted in the brand gradient.",
          base: {
            verticalAlign: "super",
            marginInlineStart: "3xs",
            fontSize: "0.7em",
            fontWeight: "medium",
            userSelect: "none",
            // inline-block makes the ref an atomic inline, so the wrapper's
            // dotted underline is NOT drawn under it — the underline stays
            // limited to the annotated text, never the ordinal.
            display: "inline-block",
            _after: {
              content: "attr(data-sidenote-number)",
              background: "bg.brandedEmphasis",
              backgroundClip: "text",
              WebkitBackgroundClip: "text",
              color: "transparent",
              WebkitTextFillColor: "transparent",
            },
          },
        }),

        sidenoteCard: defineRecipe({
          className: "sidenote-card",
          description:
            "Margin note, CSS-anchored via anchor() and revealed only when its annotation is active (caret in the editor; hover/click in the reader). `side` (default): 100px right of the text-content column (via the --sidenote-rail anchor) and 2px above the annotated line. `stacked` (no room): centred on the content column, 4px below/above the line with flip-block — like the slash menu. Vertical/default anchor is the annotation's --sn-<id> (set inline via --sn-anchor).",
          base: {
            // Fixed (not absolute) so anchor()'s flip-block fallback measures
            // overflow against the VIEWPORT — anchor positioning keeps the card
            // pinned to its annotation as the page scrolls. Absolute would size
            // the fallback against the tall <article> (always room below) and
            // never flip above.
            position: "fixed",
            zIndex: 40,
            positionAnchor: "var(--sn-anchor)",
            maxWidth: "token(sizes.sidenoteMaxWidth)",
            display: "flex",
            flexDirection: "column",
            gap: "sm",
            padding: "md",
            backgroundColor: "bg.surface",
            borderRadius: "md",
            borderWidth: "token(spacing.3xs)",
            borderStyle: "solid",
            borderColor: "border.divider",
            boxShadow:
              "0 4px 16px color-mix(in srgb, var(--colors-neutral-900) 12%, transparent)",
            color: "text.default",
            // Hidden until its annotation is active.
            opacity: 0,
            visibility: "hidden",
            pointerEvents: "none",
            transitionProperty: "opacity, visibility",
            transitionDuration: "120ms",
            transitionTimingFunction: "ease-out",
            // allow-discrete so `visibility` flips to visible at the START of the
            // reveal (not after 120ms) — otherwise the card stays unfocusable for
            // a frame and the Edit auto-focus lands on nothing.
            transitionBehavior: "allow-discrete",
            "&[data-active='true']": {
              opacity: 1,
              visibility: "visible",
              pointerEvents: "auto",
            },
          },
          variants: {
            // Horizontal geometry (`left`/`width`) is driven by inline styles the
            // SidenoteLayer computes from the rail's measured rect — it's
            // scroll-invariant (the content column's x-edges don't move on
            // vertical scroll) and avoids a SECOND named-anchor query, which
            // WebKit/Safari doesn't resolve (only the element's default
            // `position-anchor` works there; `anchor(--sidenote-rail …)` and
            // `anchor-size()` silently fail). Vertical stays CSS-anchored to the
            // annotation (`--sn-anchor`, the default anchor) so it tracks scroll.
            placement: {
              side: {
                top: "anchor(top)",
                marginTop: "calc(-1 * token(spacing.md))",
              },
              // Centred on the content column (left computed inline); 4px
              // below/above the line with flip-block.
              stacked: {
                translate: "-50% 0",
                top: "anchor(bottom)",
                marginTop: "sm",
                positionTryFallbacks: "flip-block",
              },
            },
          },
          defaultVariants: { placement: "side" },
        }),

        sidenoteCardContent: defineRecipe({
          className: "sidenote-card-content",
          description:
            "Text row of a margin-note card — the ordinal marker followed by the note body.",
          base: {
            display: "flex",
            gap: "xs",
            flex: "1 0 0",
            minWidth: 0,
            textStyle: "sidenote",
            color: "text.default",
          },
        }),

        sidenoteCardMarker: defineRecipe({
          className: "sidenote-card-marker",
          description:
            "Leading ordinal in a margin-note card (matches the annotation's superscript), painted in the brand gradient.",
          base: {
            fontWeight: "medium",
            background: "bg.brandedEmphasis",
            backgroundClip: "text",
            WebkitBackgroundClip: "text",
            color: "transparent",
            WebkitTextFillColor: "transparent",
            userSelect: "none",
          },
        }),

        sidenoteCardBody: defineRecipe({
          className: "sidenote-card-body",
          description:
            "Editable/read note body inside a margin-note card. Paragraphs are block children separated by 4px (Shift+Enter in the editor). Shows a placeholder while empty and unfocused.",
          base: {
            // inline-block (+ a min width) gives an EMPTY contentEditable a line
            // box so the caret is placeable/visible on click; caretColor makes
            // it explicit rather than relying on `auto`.
            display: "inline-block",
            minWidth: "token(spacing.md)",
            caretColor: "text.default",
            focusVisibleRing: "none",
            // Each paragraph of a note is a block child; 4px between them.
            "& > * + *": { marginTop: "sm" },
            "&[data-placeholder]:empty::after": {
              content: "attr(data-placeholder)",
              color: "text.default/40",
            },
          },
        }),

        codeBlock: defineRecipe({
          className: "code-block",
          description:
            "Code block container for article content. Inherited text styles cascade to <code> children; focus ring suppressed for contentEditable use.",
          base: {
            textStyle: "code",
            background: "bg.surface",
            borderRadius: "md",
            padding: "3xl",
            overflowX: "auto",
            color: "text.default",
            whiteSpace: "pre",
            _focusVisible: { focusVisibleRing: "none" },
          },
        }),

        articleShowcase: defineRecipe({
          className: "article-showcase",
          description:
            "Wide showcase container for figures and embeddable components inside article content.",
          base: {
            width: "token(spacing.full)",
            display: "flex",
            flexDirection: "column",
            gap: "md",
            alignItems: "center",
          },
        }),

        demoFrame: defineRecipe({
          className: "demo-frame",
          description:
            "Column shell that hugs demo-area and optional logger footer.",
          base: {
            width: "token(spacing.full)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            overflow: "hidden",
            borderRadius: "xl",
            backgroundColor: "bg.canvas",
            borderWidth: "token(spacing.3xs)",
            borderStyle: "solid",
            borderColor: "border.divider",
            containerType: "inline-size",
            containerName: "demoFrame",
            "& > *": {
              flexShrink: 0,
              maxWidth: "token(spacing.full)",
              width: "fit-content",
            },
          },
          variants: {
            logger: {
              true: {
                "& > *": {
                  width: "token(spacing.full)",
                },
              },
            },
          },
        }),

        demoFrameDemoArea: defineRecipe({
          className: "demo-frame__demo-area",
          description:
            "Demo region with aspect ratio; sizes from ratio and content.",
          base: {
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            width: "token(spacing.full)",
            maxWidth: "token(spacing.full)",
            flexShrink: 0,
            paddingBlockStart: "xxl",
            paddingBlockEnd: "lg",
          },
          variants: {
            aspectRatio: {
              sm: { aspectRatio: "2 / 1" },
              md: { aspectRatio: "3 / 2" },
              lg: { aspectRatio: "5 / 6" },
            },
            logger: {
              true: {
                height: "auto",
                aspectRatio: "unset",
                "& > *": {
                  width: "token(spacing.full)",
                  maxWidth: "token(spacing.full)",
                },
              },
            },
          },
          // A logger frame drops `aspect-ratio` (its height = demo area + footer),
          // so reserve the aspect-ratio height as a CSS floor via container-query
          // units (the frame is `container-type: inline-size`). This keeps the
          // frame at full height from SSR — no client-measured jump — while
          // content taller than the floor still grows it (height: auto). cqw
          // factor = ratioHeight / ratioWidth.
          compoundVariants: [
            {
              logger: true,
              aspectRatio: "sm",
              css: { minHeight: "50cqw" },
            },
            {
              logger: true,
              aspectRatio: "md",
              css: { minHeight: "calc(200cqw / 3)" },
            },
            {
              logger: true,
              aspectRatio: "lg",
              css: { minHeight: "120cqw" },
            },
          ],
          defaultVariants: {
            aspectRatio: "sm",
          },
          // DemoFrame selects `aspectRatio`/`logger` at RUNTIME (per registry
          // entry), so the static extractor only ever sees the default (`sm`).
          // Every non-default aspect ratio (a `md` 3:2 showcase, `lg`) and its
          // logger compound must be forced, or the variant class emits nothing
          // and the area silently falls back to its content-height min-height.
          staticCss: [
            { aspectRatio: ["*"] },
            { aspectRatio: ["*"], logger: ["*"] },
          ],
        }),

        demoFrameDemoMeasure: defineRecipe({
          className: "demo-frame__demo-measure",
          description:
            "Intrinsic-size wrapper used to measure demo content without flex stretch.",
          base: {
            width: "fit-content",
            maxWidth: "token(spacing.full)",
            flexShrink: 0,
          },
        }),

        demoLoggerSection: defineRecipe({
          className: "demo-logger-section",
          description: "Footer region for demo logger with inset padding.",
          base: {
            width: "token(spacing.full)",
            flexShrink: 0,
            padding: "md",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          },
        }),

        demoLoggerPanel: defineRecipe({
          className: "demo-logger-panel",
          description:
            "Logger shell; height transitions drive expand/collapse layout.",
          base: {
            width: "token(spacing.full)",
            borderRadius: "md",
            backgroundColor: "bg.surface",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            height: "token(spacing.4xl)",
            transitionProperty: "height",
            transitionDuration: "200ms",
            transitionTimingFunction: "ease-out",
          },
          variants: {
            expanded: {
              true: {
                height: "calc(320px - 2 * token(spacing.md))",
                _starting: {
                  height: "token(spacing.4xl)",
                },
              },
              false: {},
            },
          },
          defaultVariants: {
            expanded: true,
          },
        }),

        demoLoggerHeader: defineRecipe({
          className: "demo-logger-header",
          description:
            "Output log panel header with title and collapse toggle.",
          base: {
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            gap: "md",
            height: "token(spacing.4xl)",
            paddingInline: "lg",
          },
          variants: {
            expanded: {
              true: {
                borderBottomWidth: "token(spacing.3xs)",
                borderBottomStyle: "solid",
                borderBottomColor: "border.divider",
              },
              false: {
                borderBottom: "none",
              },
            },
          },
          defaultVariants: {
            expanded: true,
          },
        }),

        demoLoggerBody: defineRecipe({
          className: "demo-logger-body",
          description:
            "Scrollable logger output; fades inside the transitioning panel.",
          base: {
            flex: "1 1 auto",
            flexDirection: "column",
            gap: "xs",
            minHeight: 0,
            display: "flex",
            opacity: 0,
            transform: "translateY(-12px)",
            padding: "none",
            overflow: "hidden",
            pointerEvents: "none",
            transitionProperty: "opacity, transform",
            transitionDuration: "200ms",
            transitionTimingFunction: "ease-out",
          },
          variants: {
            expanded: {
              true: {
                opacity: 1,
                transform: "translateY(0)",
                padding: "md",
                overflow: "auto",
                pointerEvents: "auto",
                _starting: {
                  opacity: 0,
                  transform: "translateY(-12px)",
                },
              },
              false: {},
            },
          },
          defaultVariants: {
            expanded: true,
          },
        }),

        demoLoggerLine: defineRecipe({
          className: "demo-logger-line",
          description: "Single logger output line with level-based color.",
          base: {
            textStyle: "code",
            margin: 0,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          },
          variants: {
            level: {
              log: { color: "text.body" },
              info: { color: "text.body" },
              warn: { color: "bg.brandedEmphasis" },
              error: { color: "bg.brandedEmphasis" },
            },
          },
          defaultVariants: {
            level: "log",
          },
        }),

        articleImg: defineRecipe({
          className: "article-img",
          description:
            "Image inside article content with divider border matching demo showcase shells.",
          base: {
            width: "token(spacing.full)",
            borderRadius: "xl",
            display: "block",
            borderWidth: "token(spacing.3xs)",
            borderStyle: "solid",
            borderColor: "border.divider",
          },
        }),

        dialogPanel: defineRecipe({
          className: "dialog-panel",
          description: "Shared dialog panel shell.",
          base: {
            backgroundColor: "bg.surface",
            // The surface owns the text/glyph hue: icon buttons in the header
            // (close) and body (delete) are `color: inherit`, so without this
            // they'd fall through to the body default instead of the dialog's
            // own `text.body` — the colour the title and body copy already use.
            color: "text.body",
            borderRadius: "md",
            borderWidth: "token(spacing.3xs)",
            borderStyle: "solid",
            borderColor: "border.divider",
            overflow: "hidden",
            alignItems: "stretch",
            justifyContent: "flex-start",
            padding: "none",
          },
          variants: {
            size: {
              sm: {
                width:
                  "min(token(sizes.dialogSm), calc(100vw - token(spacing.xl) * 2))",
              },
              md: {
                width:
                  "min(token(sizes.articleContent), calc(100vw - token(spacing.xl) * 2))",
                height: "token(sizes.insertDialogHeight)",
              },
            },
          },
          defaultVariants: {
            size: "sm",
          },
        }),

        dialogHeader: defineRecipe({
          className: "dialog-header",
          description: "Dialog title row with bottom divider.",
          base: {
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
            height: "token(spacing.4xl)",
            paddingInline: "lg",
            borderBottomWidth: "token(spacing.3xs)",
            borderBottomStyle: "solid",
            borderColor: "border.divider",
            flexShrink: 0,
          },
        }),

        dialogTitle: defineRecipe({
          className: "dialog-title",
          description: "Insert-image dialog heading.",
          base: {
            margin: "none",
            padding: "none",
            textStyle: "bodySmall",
            color: "text.body",
            fontWeight: "inherit",
            textWrap: "balance",
          },
        }),

        libraryBody: defineRecipe({
          className: "library-body",
          description: "Two-column library layout between header and footer.",
          base: {
            display: "flex",
            flex: "1 1 auto",
            alignItems: "stretch",
            width: "100%",
            minHeight: 0,
          },
        }),

        dialogFooter: defineRecipe({
          className: "dialog-footer",
          description: "Dialog action row with top divider.",
          base: {
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
            height: "token(sizes.dialogFooter)",
            paddingInline: "lg",
            borderTopWidth: "token(spacing.3xs)",
            borderTopStyle: "solid",
            borderColor: "border.divider",
            flexShrink: 0,
            marginTop: "auto",
          },
        }),

        dialogFooterGroup: defineRecipe({
          className: "dialog-footer-group",
          description: "Left-aligned button cluster in dialog footer.",
          base: {
            display: "flex",
            alignItems: "center",
            gap: "md",
          },
        }),

        uploadBodySlot: defineRecipe({
          className: "upload-body-slot",
          description:
            "Flex-grow region that centers the upload block in the dialog content area (Figma y=156 in 480px shell).",
          base: {
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            flex: "1 1 0%",
            width: "100%",
            minHeight: 0,
          },
        }),

        uploadBody: defineRecipe({
          className: "upload-body",
          description:
            "Upload / uploading content block (Figma Frame 25: 280×160).",
          base: {
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "xs",
            width: "token(sizes.imagePreviewMax)",
            height: "160px",
            flexShrink: 0,
            cursor: "pointer",
            textAlign: "center",
          },
          variants: {
            dragOver: {
              true: {
                backgroundColor: "bg.itemHover",
                borderRadius: "sm",
              },
              false: {},
            },
          },
          defaultVariants: {
            dragOver: false,
          },
        }),

        uploadProgress: defineRecipe({
          className: "upload-progress",
          description:
            "Shared progress-bar track (upload dialog + demo preloader).",
          base: {
            position: "relative",
            width: "token(sizes.imagePreviewMax)",
            maxWidth: "token(spacing.full)",
            height: "token(spacing.xxs)",
            borderRadius: "xs",
            backgroundColor: "border.divider",
            overflow: "hidden",
          },
        }),

        progressBarFill: defineRecipe({
          className: "progress-bar-fill",
          description: "Animated fill inside the shared progress-bar track.",
          base: {
            position: "absolute",
            top: 0,
            left: 0,
            height: "token(spacing.full)",
            borderRadius: "xs",
            transition: "width linear 100ms",
            backgroundColor: { base: "brand.pink", _dark: "brand.orange" },
          },
        }),

        demoPreloader: defineRecipe({
          className: "demo-preloader",
          description:
            "Centers the shared progress bar while a component demo loads.",
          base: {
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "md",
            width: "token(sizes.imagePreviewMax)",
            maxWidth: "token(spacing.full)",
            minHeight: "token(spacing.5xl)",
            paddingInline: "lg",
          },
        }),

        mediaLibrarySidebar: defineRecipe({
          className: "media-library-sidebar",
          description:
            "Library sidebar column in the insert dialogs — the frame around an OptionList.Listbox (component list / image list). Owns the width, divider and inset; the listbox inside owns the scrolling, since it keeps its own active row in view by nudging its scrollTop.",
          base: {
            width: "token(sizes.librarySidebar)",
            flexShrink: 0,
            alignSelf: "stretch",
            borderRightWidth: "token(spacing.3xs)",
            borderRightStyle: "solid",
            borderColor: "border.divider",
            paddingBlock: "md",
            paddingInline: "sm",
            display: "flex",
            flexDirection: "column",
            gap: "none",
            minHeight: 0,
            overflow: "hidden",
          },
        }),

        mediaPreview: defineRecipe({
          className: "media-preview",
          description:
            "Large image preview in insert-image library view. HEIGHT is the only fixed dimension (280px) — the width hugs the image's own aspect ratio and stretches at most to the pane's content box (`maxWidth: 100%` resolves against the flex container's content box, so the pane's padding is excluded). Fixed rather than max height so the metadata rows below hold their position as you switch images; `object-fit: contain` letterboxes anything the width clamp squeezes.",
          base: {
            height: "token(sizes.imagePreviewMax)",
            width: "auto",
            maxWidth: "token(spacing.full)",
            flexShrink: 0,
            margin: "none",
            "& img": {
              height: "100%",
              width: "auto",
              maxWidth: "token(spacing.full)",
              objectFit: "contain",
              display: "block",
              borderRadius: "sm",
              outline: "[none]",
            },
          },
        }),

        mediaPreviewPane: defineRecipe({
          className: "media-preview-pane",
          description:
            "Right column of library view with preview and metadata.",
          base: {
            flex: "1 1 auto",
            alignSelf: "stretch",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "xs",
            paddingBlock: "md",
            paddingInline: "md",
            minWidth: 0,
            minHeight: 0,
            overflowY: "auto",
          },
        }),

        mediaMetadataRow: defineRecipe({
          className: "media-metadata-row",
          description: "Filename and file-size row below preview.",
          base: {
            display: "flex",
            alignItems: "center",
            gap: "xl",
            width: "100%",
            maxWidth: "token(sizes.imagePreviewMax)",
            minWidth: 0,
            textStyle: "caption",
          },
        }),

        mediaAltRow: defineRecipe({
          className: "media-alt-row",
          description: "Alt-text field row below metadata.",
          base: {
            width: "100%",
            maxWidth: "token(sizes.imagePreviewMax)",
            minWidth: 0,
            alignSelf: "center",
          },
        }),

        mediaDeleteRow: defineRecipe({
          className: "media-delete-row",
          description: "Delete action row below alt text in media preview.",
          base: {
            display: "flex",
            justifyContent: "center",
            width: "100%",
            maxWidth: "token(sizes.imagePreviewMax)",
            minWidth: 0,
            alignSelf: "center",
          },
        }),

        mediaThumbnail: defineRecipe({
          className: "media-thumbnail",
          description: "Small thumbnail in image library sidebar.",
          base: {
            position: "relative",
            flexShrink: 0,
            width: "token(spacing.xxl)",
            height: "token(spacing.xxl)",
            borderRadius: "xs",
            borderWidth: "token(spacing.3xs)",
            borderStyle: "solid",
            borderColor: "border.divider",
            overflow: "hidden",
            "& img": {
              position: "absolute",
              inset: "0",
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
            },
          },
        }),

        articleBlockquoteShell: defineRecipe({
          className: "article-blockquote-shell",
          description:
            "Blockquote layout shell — quote mark and text in normal flow (Figma 358:20 light, 358:26 dark).",
          base: {
            display: "flex",
            flexDirection: "row",
            alignItems: "flex-start",
            gap: "sm",
          },
        }),

        articleBlockquoteMark: defineRecipe({
          className: "article-blockquote-mark",
          description:
            "Quote mark (52×52) drawn as the brand gradient, masked to the blockquote glyph so it theme-flips with the gradient token.",
          base: {
            width: "token(sizes.quoteMark)",
            height: "token(sizes.quoteMark)",
            flexShrink: 0,
            pointerEvents: "none",
            // The gradient fills the box; the blockquote glyph (src/assets/icons/
            // blockquote.svg, inlined) masks it to shape via its alpha channel.
            background: "bg.brandedEmphasis",
            maskImage:
              "url(\"data:image/svg+xml,%3Csvg width='52' height='52' viewBox='0 0 52 52' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M14.5596 8.32031C15.4635 8.32031 16.1963 9.05306 16.1963 9.95703C16.1962 10.3244 16.073 10.6811 15.8457 10.9697C13.6019 13.8179 12.4805 17.7879 12.4805 22.8799H20.7998C21.9485 22.8799 22.8799 23.8112 22.8799 24.96V41.5996C22.8799 42.7484 21.9486 43.6797 20.7998 43.6797H6.24023C5.09148 43.6797 4.16016 42.7484 4.16016 41.5996V27.04C4.16016 16.6408 12.4789 8.32146 14.5596 8.32031ZM39.5195 8.32031C40.4235 8.32031 41.1572 9.05306 41.1572 9.95703C41.1572 10.3244 41.033 10.6811 40.8057 10.9697C38.5619 13.8179 37.4404 17.788 37.4404 22.8799H45.7598C46.9085 22.8799 47.8398 23.8112 47.8398 24.96V41.5996C47.8398 42.7484 46.9085 43.6797 45.7598 43.6797H31.2002C30.0514 43.6797 29.1201 42.7484 29.1201 41.5996V27.04C29.1201 16.6408 37.4388 8.32156 39.5195 8.32031Z' fill='white'/%3E%3C/svg%3E\")",
            maskSize: "contain",
            maskRepeat: "no-repeat",
            maskPosition: "center",
            WebkitMaskImage:
              "url(\"data:image/svg+xml,%3Csvg width='52' height='52' viewBox='0 0 52 52' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M14.5596 8.32031C15.4635 8.32031 16.1963 9.05306 16.1963 9.95703C16.1962 10.3244 16.073 10.6811 15.8457 10.9697C13.6019 13.8179 12.4805 17.7879 12.4805 22.8799H20.7998C21.9485 22.8799 22.8799 23.8112 22.8799 24.96V41.5996C22.8799 42.7484 21.9486 43.6797 20.7998 43.6797H6.24023C5.09148 43.6797 4.16016 42.7484 4.16016 41.5996V27.04C4.16016 16.6408 12.4789 8.32146 14.5596 8.32031ZM39.5195 8.32031C40.4235 8.32031 41.1572 9.05306 41.1572 9.95703C41.1572 10.3244 41.033 10.6811 40.8057 10.9697C38.5619 13.8179 37.4404 17.788 37.4404 22.8799H45.7598C46.9085 22.8799 47.8398 23.8112 47.8398 24.96V41.5996C47.8398 42.7484 46.9085 43.6797 45.7598 43.6797H31.2002C30.0514 43.6797 29.1201 42.7484 29.1201 41.5996V27.04C29.1201 16.6408 37.4388 8.32156 39.5195 8.32031Z' fill='white'/%3E%3C/svg%3E\")",
            WebkitMaskSize: "contain",
            WebkitMaskRepeat: "no-repeat",
            WebkitMaskPosition: "center",
          },
        }),

        articleBlockquote: defineRecipe({
          className: "article-blockquote",
          description: "Blockquote typography inside article prose.",
          base: {
            textStyle: "quote",
            color: "text.default",
            wordBreak: "break-word",
            paddingBlockStart: "xl",
          },
        }),

        articleHeadingShell: defineRecipe({
          className: "article-heading-shell",
          description:
            "Column that stacks an optional eyebrow caption above a subheading.",
          base: {
            display: "flex",
            flexDirection: "column",
            gap: "sm",
          },
        }),

        articleSubheadingCaption: defineRecipe({
          className: "article-subheading-caption",
          description:
            "Eyebrow caption above a subheading — brand gradient text (same gradient as numbered-list ordinals) revealed via background-clip once populated.",
          base: {
            textStyle: "caption",
            width: "fit-content",
            wordBreak: "break-word",
            // Only clip the gradient into the glyphs once there is text — an
            // empty editor field keeps its normal placeholder colour instead of
            // turning the placeholder transparent.
            "&:not(:empty):not([data-empty])": {
              background: "bg.brandedEmphasis",
              backgroundClip: "text",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            },
          },
        }),

        articleBlockquoteBody: defineRecipe({
          className: "article-blockquote-body",
          description:
            "Column beside the quote mark that stacks the quote text and an optional citation.",
          base: {
            flex: "1 1 auto",
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
            gap: "sm",
          },
        }),

        articleBlockquoteCite: defineRecipe({
          className: "article-blockquote-cite",
          description:
            "Citation line beneath a blockquote — caption typography, upright (not italic).",
          base: {
            textStyle: "caption",
            fontStyle: "normal",
            color: "text.body/50",
            wordBreak: "break-word",
          },
        }),

        articleList: defineRecipe({
          className: "article-list",
          description:
            "Ordered-list wrapper for read-only article prose — resets native list styling and stacks items with the same rhythm as sibling blocks. No width: inherits the `article > *` content-column width so the list aligns with prose, not showcase blocks.",
          base: {
            listStyle: "none",
            margin: "none",
            padding: "none",
            display: "flex",
            flexDirection: "column",
            gap: "xl",
          },
        }),

        articleListItemShell: defineRecipe({
          className: "article-list-item-shell",
          description:
            "Numbered-list item row — ordinal badge and text content in a flex row (Figma 413:684 light, 413:688 dark). No width: inherits the `article > *` content-column width (a recipe-layer width would beat the base-layer rule and align the marker with showcase blocks).",
          base: {
            display: "flex",
            flexDirection: "row",
            alignItems: "flex-start",
            gap: "md",
          },
        }),

        listMarker: defineRecipe({
          className: "list-marker",
          description:
            "Numbered-list ordinal badge — gradient pill with theme-flipped digits; square at single digit, widens for zero-padded multi-digit ordinals.",
          base: {
            flexShrink: 0,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            height: "token(sizes.listMarker)",
            minWidth: "token(sizes.listMarker)",
            marginBlockStart: "xs",
            paddingInline: "sm",
            borderRadius: "lg",
            background: "bg.brandedEmphasis",
            color: "text.listMarker",
            textStyle: "bodyLarge",
            fontWeight: "medium",
            textAlign: "center",
            whiteSpace: "nowrap",
            userSelect: "none",
            pointerEvents: "none",
          },
        }),

        listBullet: defineRecipe({
          className: "list-bullet",
          description:
            "Bulleted-list marker — 10px circular gradient dot centered on the first text line, within the same footprint as the numbered ordinal badge.",
          base: {
            flexShrink: 0,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            height: "token(sizes.listMarker)",
            minWidth: "token(sizes.listMarker)",
            marginBlockStart: "xs",
            userSelect: "none",
            pointerEvents: "none",
            "&::before": {
              content: '""',
              display: "block",
              width: "token(sizes.listBullet)",
              height: "token(sizes.listBullet)",
              borderRadius: "token(spacing.half)",
              background: "bg.brandedEmphasis",
            },
          },
        }),

        listBulletIcon: defineRecipe({
          className: "list-bullet-icon",
          description:
            "Check/cross bulleted-list marker — the 24px alignment box (matching the dot and the numbered ordinal, so content stays aligned across list styles) centring a `listBulletCircle` glyph.",
          base: {
            flexShrink: 0,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            height: "token(sizes.listMarker)",
            minWidth: "token(sizes.listMarker)",
            marginBlockStart: "xs",
            userSelect: "none",
            pointerEvents: "none",
          },
        }),

        listBulletCircle: defineRecipe({
          className: "list-bullet-circle",
          description:
            "The 16×16 gradient circle inside a check/cross bullet marker (Figma 476:278 check, 474:38 cross) — holds the 20px glyph, which overflows slightly and inherits `text.listMarker` via currentColor so it theme-flips like the ordinal digits.",
          base: {
            flexShrink: 0,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: "token(spacing.xl)",
            height: "token(spacing.xl)",
            borderRadius: "token(spacing.half)",
            background: "bg.brandedEmphasis",
            color: "text.listMarker",
          },
        }),

        articleListItemContent: defineRecipe({
          className: "article-list-item-content",
          description:
            "List item text column beside the ordinal badge or bullet dot.",
          base: {
            flex: "1 1 auto",
            minWidth: 0,
            textStyle: "bodyLarge",
            color: "text.body",
            wordBreak: "break-word",
          },
        }),

        articleMetric: defineRecipe({
          className: "article-metric",
          description:
            "Metric callout — a large brand-gradient value stacked over a descriptive label (Figma 456:979 light / 456:968 dark). No width: inherits the `article > *` content-column width so it aligns with prose.",
          base: {
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            gap: "sm",
            wordBreak: "break-word",
          },
        }),

        articleMetricCaption: defineRecipe({
          className: "article-metric-caption",
          description:
            "Metric caption — optional eyebrow above the value; same style as an image caption but left-aligned (the metric column is flush-left).",
          base: {
            textStyle: "caption",
            color: "text.default",
            textAlign: "left",
            wordBreak: "break-word",
          },
        }),

        articleMetricValue: defineRecipe({
          className: "article-metric-value",
          description:
            "Metric value — brand gradient display text (theme-directional gradient) revealed via background-clip once populated, mirroring the subheading eyebrow.",
          base: {
            textStyle: "title",
            width: "fit-content",
            maxWidth: "full",
            wordBreak: "break-word",
            // Clip the gradient into the glyphs only once there is text — an empty
            // editor field keeps its normal placeholder colour.
            "&:not(:empty):not([data-empty])": {
              background: "bg.brandedEmphasis",
              backgroundClip: "text",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            },
          },
        }),

        articleMetricLabel: defineRecipe({
          className: "article-metric-label",
          description:
            "Metric label — descriptive line beneath the value; paragraph text style, standard text colour (neutral.600 light / neutral.200 dark per Figma).",
          base: {
            textStyle: "bodyLarge",
            color: "text.default",
            wordBreak: "break-word",
          },
        }),

        horizontalRule: defineRecipe({
          className: "horizontal-rule",
          description:
            "Horizontal rule rendered identically on both read-only and edit article surfaces.",
          base: {
            border: "none",
            height: "token(spacing.3xs)",
            backgroundColor: "border.divider",
            marginBlock: "3xl",
          },
        }),

        menuPopover: defineRecipe({
          className: "menu-popover",
          description:
            "Floating menu shell — collapsed (default resting state) shows one item; expanded shows a list.",
          base: {
            position: "fixed",
            zIndex: 50,
            width: "200px",
            backgroundColor: "bg.surface",
            borderRadius: "md",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          },
          variants: {
            state: {
              collapsed: {
                alignItems: "flex-start",
                justifyContent: "center",
                padding: "sm",
              },
              expanded: {
                paddingBlock: "md",
                paddingInline: "sm",
                gap: "xs",
                boxShadow:
                  "0 4px 16px color-mix(in srgb, var(--colors-neutral-900) 12%, transparent)",
              },
            },
          },
          defaultVariants: {
            state: "collapsed",
          },
        }),

        slashMenuPopover: defineRecipe({
          className: "slash-menu-popover",
          description:
            "Slash menu — positioned with CSS anchor() against the active block's anchor-name. Fixed (not absolute) so position-try-fallbacks measures overflow against the viewport — otherwise flip-block never fires (the containing block is taller than the viewport, so there's always 'room below').",
          base: {
            position: "fixed",
            zIndex: 50,
            width: "200px",
            positionAnchor: "--slash-menu",
            top: "anchor(bottom)",
            left: "anchor(left)",
            marginTop: "xs",
            positionTryFallbacks: "flip-block",
            backgroundColor: "bg.surface",
            borderRadius: "md",
            borderWidth: "token(spacing.3xs)",
            borderStyle: "solid",
            borderColor: "border.divider",
            display: "flex",
            flexDirection: "column",
            overflow: "visible",
            // No internal padding — the OptionList.Listbox's own 4px inset is the
            // only gap between the panel edge and the rows (its root collapses via
            // the `plain` tone, so the listbox sits directly in this popover).
            boxShadow:
              "0 4px 16px color-mix(in srgb, var(--colors-neutral-900) 12%, transparent)",
          },
        }),

        // The Date input's calendar popover — positioned to COVER the trigger
        // frame (top/left of the anchor, at least its width) rather than sit
        // below it, so the popover's search row lands over the collapsed value
        // (Figma 563:2486). Anchor-name `--date-popover` is set on the frame only
        // while open, so exactly one element carries it. Opaque tinted surface +
        // brand inset border.
        datePopover: defineRecipe({
          className: "date-popover",
          description:
            "Covering calendar popover for the Date input: anchored over the trigger frame (top/left, ≥ its width) with an opaque brand-tinted surface + brand inset border. Distinct from the below-anchored menu popovers.",
          base: {
            position: "fixed",
            zIndex: 50,
            positionAnchor: "--date-popover",
            top: "anchor(top)",
            left: "anchor(left)",
            minWidth: "anchor-size(width)",
            backgroundColor: "field.bg.popover",
            borderRadius: "sm",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            boxShadow:
              "inset 0 0 0 0.5px var(--colors-field-border-active), 0 4px 16px color-mix(in srgb, var(--colors-neutral-900) 12%, transparent)",
          },
        }),

        // The Combobox input's option-list popover — the Select counterpart to
        // datePopover. Same covering behaviour (anchored over the trigger frame
        // via `--combobox-popover`, opaque brand-tinted surface + brand inset
        // border), but sized to the option list: at least `optionListWidth`, and
        // never narrower than the trigger (Figma 629:1416 dark / 630:1702 light).
        comboboxPopover: defineRecipe({
          className: "combobox-popover",
          description:
            "Covering option-list popover for the Combobox input: anchored over the trigger frame (top/left) with an opaque brand-tinted surface + brand inset border, ≥ the option-list width and ≥ the trigger width. The Select sibling of datePopover.",
          base: {
            position: "fixed",
            zIndex: 50,
            positionAnchor: "--combobox-popover",
            top: "anchor(top)",
            left: "anchor(left)",
            width: "token(sizes.optionListWidth)",
            minWidth: "anchor-size(width)",
            backgroundColor: "field.bg.popover",
            borderRadius: "sm",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            boxShadow:
              "inset 0 0 0 0.5px var(--colors-field-border-active), 0 4px 16px color-mix(in srgb, var(--colors-neutral-900) 12%, transparent)",
          },
        }),

        selectionPopover: defineRecipe({
          className: "selection-popover",
          description:
            "Shared floating popover for the text-selection / link / numbering / bullet menus — anchored above the target via CSS anchor() and flipped below when there's no room (Figma 422:833 selection, 474:74 numbering, 475:204 bullet). `align=center` centres on the target (text selection / link); `align=start` left-aligns to it (list-marker menus).",
          base: {
            position: "fixed",
            zIndex: 50,
            positionAnchor: "--selection-popover",
            // Default above the target; flip below when there is no room.
            bottom: "anchor(top)",
            marginBottom: "sm",
            positionTryFallbacks: "flip-block",
            display: "flex",
            alignItems: "center",
            gap: "sm",
            // Hug the options — also overrides the `article > *` width rule
            // (@layer base) that would otherwise stretch it to the text column.
            width: "max-content",
            maxWidth: "min(100vw, token(sizes.articleContent))",
            height: "token(spacing.4xl)",
            paddingInline: "md",
            backgroundColor: "bg.surface",
            borderRadius: "md",
            borderWidth: "token(spacing.3xs)",
            borderStyle: "solid",
            borderColor: "border.divider",
            overflow: "hidden",
            boxShadow:
              "0 4px 16px color-mix(in srgb, var(--colors-neutral-900) 12%, transparent)",
          },
          variants: {
            align: {
              center: { left: "anchor(center)", translate: "-50% 0" },
              start: { left: "anchor(left)" },
            },
          },
          defaultVariants: { align: "center" },
        }),

        tooltip: defineRecipe({
          className: "tooltip",
          description:
            "Cursor-following hover tooltip shared by the social links, Button and Link — Figma node 389:318 (20px tall, 4px padding/gap, a leading label ∣ hairline ∣ trailing 14px glyph). Positioned imperatively (fixed + a ref that tracks the pointer), so it carries no anchor of its own.",
          base: {
            position: "fixed",
            zIndex: 50,
            top: 0,
            left: 0,
            display: "flex",
            alignItems: "center",
            gap: "sm",
            height: "token(spacing.xxl)",
            paddingInline: "sm",
            paddingBlock: "none",
            overflow: "hidden",
            borderRadius: "sm",
            borderWidth: "token(spacing.3xs)",
            borderStyle: "solid",
            borderColor: "border.divider",
            backgroundColor: { base: "neutral.200", _dark: "neutral.800" },
            color: "text.body",
            textStyle: "caption",
            whiteSpace: "nowrap",
            opacity: 0,
            visibility: "hidden",
            pointerEvents: "none",
            filter: "blur(1px)",
            transitionProperty: "opacity, filter, visibility",
            transitionDuration: "150ms",
            transitionTimingFunction: "ease-out",
            transitionBehavior: "allow-discrete",
            _starting: {
              opacity: 0,
              filter: "blur(1px)",
            },
            // Shown by its host toggling `data-visible` on the element itself
            // (`.tooltip[data-visible]` outspecifies the base `.tooltip` within
            // @layer recipes — no unlayered override needed). The cursor trails
            // the box by its offset, so `pointer-events: auto` never intercepts
            // the pointer yet lets an interactive tooltip (the email copy) be hit.
            "&[data-visible]": {
              opacity: 1,
              visibility: "visible",
              pointerEvents: "auto",
              filter: "blur(0)",
            },
            // A composed trailing glyph is tooltip-sized (14px) and tracks the
            // label colour — no per-icon className needed.
            "& svg": {
              flexShrink: 0,
              width: "token(sizes.tooltipIcon)",
              height: "token(sizes.tooltipIcon)",
            },
            "& svg path[stroke]": { stroke: "currentColor" },
            "& svg path[fill]": { fill: "currentColor" },
          },
        }),

        tooltipIcon: defineRecipe({
          className: "tooltip-icon",
          description:
            "Icons inside tooltips — fixed 14px size, never shrinks. For icons that need an explicit class (the social copy/check crossfade layers); a bare tooltip glyph is already sized by the `tooltip` recipe's `& svg`.",
          base: {
            flexShrink: 0,
            width: "token(sizes.tooltipIcon)",
            height: "token(sizes.tooltipIcon)",
            "& path[stroke]": { stroke: "currentColor" },
            "& path[fill]": { fill: "currentColor" },
          },
        }),

        menuIcon: defineRecipe({
          className: "menu-icon",
          description:
            "Shared icon style for menu items — fixed 20px size, never shrinks.",
          base: {
            flexShrink: 0,
            width: "token(spacing.xxl)",
            height: "token(spacing.xxl)",
          },
        }),

        menuItem: defineRecipe({
          className: "menu-item",
          description:
            "Shared item row for the command palette (cmdk) and the slash menu.",
          base: {
            display: "flex",
            alignItems: "center",
            width: "100%",
            gap: "md",
            height: "token(spacing.3xl)",
            paddingInline: "md",
            borderRadius: "sm",
            cursor: "default",
            textStyle: "bodySmall",
            color: "text.body",
            // cmdk sets data-selected; slash-menu uses aria-selected on native buttons
            "&[data-selected='true'], &[aria-selected='true']": {
              backgroundColor: "bg.itemHover",
            },
          },
        }),
      },

      slotRecipes: {
        field: defineSlotRecipe({
          className: "field",
          description:
            "Text-input family field — a label, a framed input shell (leading icon + control + optional trailing), and a hint. The presentational frame owns no behavior; the assembly fills the control slot. The 'Active' state is CSS-driven off the control's focus (`[data-control]:focus-visible`) rather than a prop, so label, frame bg/border, control text and the leading icon all shift to the brand accent (pink in light, orange in dark) on focus while the hint stays muted (Figma 586:876). Built to be shared by the forthcoming Select/Date inputs. A `role=\"switch\"` control flips the same root into a control ∣ label/hint grid (the Switch archetype), detected via `:has` — no prop. Scope: default + active only.",
          slots: ["root", "label", "frame", "control", "hint"],
          base: {
            root: {
              display: "flex",
              flexDirection: "column",
              alignItems: "stretch",
              width: "token(spacing.full)",
              // A switch control flips the field from a vertical stack into the
              // control ∣ label/hint grid — same field, a different archetype,
              // detected structurally (no prop) the way the active state keys
              // off :focus-visible. Text inputs never match, so they're unaffected.
              "&:has([role='switch'])": {
                display: "grid",
                gridTemplateColumns: "auto 1fr",
                alignItems: "center",
                rowGap: "xs",
                columnGap: "md",
                width: "fit-content",
              },
            },
            label: {
              color: "field.text.muted",
              width: "token(spacing.full)",
              wordBreak: "break-word",
              cursor: "default",
              transition: "color 150ms ease",
              // Active tracks the control's focus from the field root, so the
              // label (a sibling above the frame) recolors even though it sits
              // outside the shell.
              "[data-field]:has([data-control]:focus-visible, [data-control][aria-expanded='true']) &":
                {
                  color: "field.text.active",
                },
              // Switch archetype: the label sits to the right of the control as a
              // full statement — so it reads as the field family's resting text
              // (`field.text.default`, matching the input values), not the muted
              // field label nor the brighter app body text; clicking it toggles,
              // so it takes the pointer cursor (Figma 684:1133 dark neutral.400 /
              // light neutral.600).
              "[data-field]:has([role='switch']) &": {
                gridColumn: 2,
                gridRow: 1,
                width: "auto",
                color: "field.text.default",
                cursor: "pointer",
              },
            },
            frame: {
              display: "flex",
              alignItems: "center",
              gap: "md",
              width: "token(spacing.full)",
              paddingInline: "md",
              borderRadius: "sm",
              borderWidth: "token(spacing.3xs)",
              borderStyle: "solid",
              overflow: "hidden",
              // Clicking the frame's dead padding focuses the control, so it
              // should read as a text field.
              cursor: "text",
              backgroundColor: "field.bg.default",
              borderColor: "field.border.default",
              // Frame `color` is the single source for the leading icon and the
              // control (both `color: inherit`); the active selector flips all
              // three at once.
              color: "field.text.default",
              transition:
                "background-color 150ms ease, border-color 150ms ease, color 150ms ease",
              "[data-field]:has([data-control]:focus-visible, [data-control][aria-expanded='true']) &":
                {
                  backgroundColor: "field.bg.active",
                  borderColor: "field.border.active",
                  color: "field.text.active",
                },
              // Keyboard focus draws the ring on the shell (as the command
              // palette does for its input row) so it hugs the whole field,
              // icon included, rather than the raw input. Inset so the frame's
              // overflow:hidden can't clip it; width/colour match the app-wide
              // keyboard ring in globals.css.
              "html[data-keyboard-focus] [data-field]:has([data-control]:focus-visible) &":
                {
                  boxShadow:
                    "inset 0 0 0 1.5px var(--colors-border-focus-ring)",
                },
              // Icons compose straight into the frame — a leading `<Icon/>` before
              // the control, or a trailing one after it (the Date/Select triggers).
              // A fixed 20px box that inherits the frame's colour (so it tracks the
              // active accent) and is non-interactive, so clicks fall through to the
              // frame's focus-forward / open target. `> svg` keeps it off any icon
              // that might live inside the control itself.
              "& > svg": {
                flexShrink: 0,
                width: "token(spacing.xxl)",
                height: "token(spacing.xxl)",
                display: "block",
                pointerEvents: "none",
                transition: "color 150ms ease",
              },
              "& > svg path[stroke]": { stroke: "currentColor" },
              "& > svg path[fill]": { fill: "currentColor" },
            },
            control: {
              flex: "1 1 0",
              minWidth: 0,
              width: "token(spacing.full)",
              margin: "none",
              padding: "none",
              border: "none",
              background: "transparent",
              appearance: "none",
              color: "inherit",
              transition: "color 150ms ease",
              caretColor: "field.text.active",
              // Placeholder text — the native input's `::placeholder` and the
              // Select/Date trigger's `[data-placeholder]` sentinel share one
              // rule. Resting is the neutral placeholder tone; when the field
              // goes active (control focus-visible, or an open trigger's
              // aria-expanded) it tracks the label / value / leading icon into
              // the accent via `activeMuted` (the brand-surface counterpart of
              // the placeholder tone, same 25%) rather than staying stranded in
              // neutral grey against the now brand-tinted frame.
              "&::placeholder, &[data-placeholder]": {
                color: "field.text.placeholder",
              },
              "[data-field]:has([data-control]:focus-visible, [data-control][aria-expanded='true']) &::placeholder, [data-field]:has([data-control]:focus-visible, [data-control][aria-expanded='true']) &[data-placeholder]":
                { color: "field.text.activeMuted" },
              // The UA outline is already reset app-wide (globals.css). The
              // app-wide keyboard ring, however, targets the raw <input>, which
              // this frame's overflow:hidden clips into an awkward inner
              // rectangle — suppress it so the frame can carry the ring instead.
              "html[data-keyboard-focus] &:focus-visible": {
                boxShadow: "none",
              },
            },
            hint: {
              color: "field.text.muted",
              width: "token(spacing.full)",
              wordBreak: "break-word",
              marginTop: "sm",
              // Switch archetype: the hint drops under the label (grid row 2),
              // aligned to it rather than stacked with its own top margin.
              "[data-field]:has([role='switch']) &": {
                gridColumn: 2,
                gridRow: 2,
                width: "auto",
                marginTop: "none",
              },
            },
          },
          // Size scales the field as a coordinated set — label, value, hint,
          // and frame height move together in proportion, so you get a "small
          // field" or a "large field" rather than a mismatched label over a
          // normal input. `md` is the Figma default (586:876); `lg` steps each
          // part up one text style and the frame up 8px so the value's taller
          // line-height keeps the same 6px vertical inset. `sm` is the compact
          // step used by the switch archetype (caption label + hint, tighter
          // column gap); text inputs stay on md/lg.
          variants: {
            size: {
              sm: {
                label: { textStyle: "caption" },
                hint: { textStyle: "caption" },
                root: { "&:has([role='switch'])": { columnGap: "sm" } },
              },
              md: {
                label: { textStyle: "bodySmall" },
                control: { textStyle: "bodyLarge" },
                hint: { textStyle: "sidenote" },
                frame: { height: "token(spacing.4xl)" },
              },
              lg: {
                label: { textStyle: "bodyLarge" },
                control: { textStyle: "subheading" },
                hint: { textStyle: "bodySmall" },
                frame: {
                  height: "calc(token(spacing.4xl) + token(spacing.md))",
                },
              },
            },
          },
          defaultVariants: { size: "md" },
          // FieldRoot calls field({ size }) with a runtime value, so the static
          // extractor only sees the default (md) — force sm/lg to be generated
          // too, else their label/hint/frame styles silently render nothing.
          staticCss: [{ size: ["*"] }],
        }),

        // Named `switchField` (not `switch` — a reserved word breaks the
        // generated `export const switch`). Just the toggle visual now: the
        // track + thumb. The surrounding layout (control ∣ label/hint grid) and
        // the label/hint typography come from the shared `field` recipe, which
        // the Switch plugs into as its control — so this recipe owns only what
        // is switch-specific. Track = `field.bg/border.*`, thumb =
        // `field.text.*`, keyed off `aria-checked` (Figma 607:1166).
        switchField: defineSlotRecipe({
          className: "switch-field",
          description:
            "The track + thumb of a toggle switch — the control slot of a `field`. Off = neutral, on = brand accent (keyed off `aria-checked` on the <button role=switch>), reusing the field tokens the text input uses. `size` scales the track geometry and thumb travel (sm/lg); the label/hint and the control ∣ text layout come from the `field` recipe. Geometry derives from spacing tokens — track height = thumb + 2·inset, travel = width − 2·inset − thumb — so nothing is arbitrary.",
          slots: ["control", "thumb"],
          base: {
            control: {
              // Placed in the field grid the `field` recipe sets up when a
              // switch is present: first column, aligned with the label row.
              gridColumn: 1,
              gridRow: 1,
              position: "relative",
              flexShrink: 0,
              display: "inline-block",
              padding: "none",
              margin: "none",
              appearance: "none",
              cursor: "pointer",
              // Pill: 12px ≥ half of either track height, so both sizes read
              // fully rounded.
              borderRadius: "lg",
              backgroundColor: "field.bg.default",
              // The 0.5px edge is an inset box-shadow, NOT a `border`: with
              // box-sizing:border-box a real border is subtracted from the
              // interior (24→23px), and the absolutely-positioned thumb is
              // offset from the padding edge (inside the border), so top:4 lands
              // 4.5px above / 3.5px below — visibly off-centre. A box-shadow
              // takes no layout, so the interior stays the full 24px and the
              // thumb's 4+16+4 insets centre it exactly on both axes.
              boxShadow:
                "inset 0 0 0 token(spacing.3xs) var(--colors-field-border-default)",
              transition: "background-color 150ms ease, box-shadow 150ms ease",
              "&[aria-checked='true']": {
                backgroundColor: "field.bg.active",
                boxShadow:
                  "inset 0 0 0 token(spacing.3xs) var(--colors-field-border-active)",
              },
              _disabled: { cursor: "not-allowed", opacity: 0.5 },
            },
            thumb: {
              position: "absolute",
              borderRadius: "token(spacing.half)",
              backgroundColor: "field.text.default",
              transition: "transform 150ms ease, background-color 150ms ease",
              "[aria-checked='true'] &": {
                backgroundColor: "field.text.active",
              },
            },
          },
          variants: {
            size: {
              lg: {
                control: {
                  width: "token(spacing.4xl)",
                  height: "calc(token(spacing.xl) + 2 * token(spacing.sm))",
                },
                thumb: {
                  width: "token(spacing.xl)",
                  height: "token(spacing.xl)",
                  top: "token(spacing.sm)",
                  left: "token(spacing.sm)",
                  "[aria-checked='true'] &": {
                    transform: "translateX(token(spacing.xl))",
                  },
                },
              },
              sm: {
                control: {
                  width: "token(spacing.xxl)",
                  height: "calc(token(spacing.md) + 2 * token(spacing.xs))",
                },
                thumb: {
                  width: "token(spacing.md)",
                  height: "token(spacing.md)",
                  top: "token(spacing.xs)",
                  left: "token(spacing.xs)",
                  "[aria-checked='true'] &": {
                    transform: "translateX(token(spacing.md))",
                  },
                },
              },
            },
          },
          defaultVariants: { size: "lg" },
          // The Switch component calls switchField({ size }) with a runtime
          // value, so the static extractor only sees the default (lg). Force
          // both size variants to be generated.
          staticCss: [{ size: ["*"] }],
        }),

        // The calendar grid popover for the Date input. Presentation only — the
        // month math (Temporal) and selection live in `calendar.tsx`. Slots map
        // 1:1 to the compound parts: `search` (Field.Search at the top),
        // `periodList` (the row of months, plus the absolutely-placed `nav`
        // chevrons that page it), `period` (one month column) built from
        // `month` (its "July 2026" label), `week`/`weekday` (the S M T… header
        // row) and `grid`/`date` (the day cells). Date state is keyed off
        // attributes the cell sets itself — `aria-selected`, `data-state`
        // (today), `data-outside` (spill days), `:disabled` (out of min/max) —
        // so consumers can restyle any of them (including
        // `data-weekend`/`data-weekday`) without prop APIs.
        calendar: defineSlotRecipe({
          className: "calendar",
          description:
            "Calendar grid: a search field above a period list — one or more month columns, each a ‹ month year › label, the weekday header row and the day grid on a 24px cell / 4px gutter pitch (7 × 24 + 6 × 4 + 2 × 8 padding = 208px per month). The pair of nav chevrons is absolutely placed at the list's top corners, so they flank the whole range rather than a single month, and the list pages a full range at a time (Figma 715:912 — three months at 624px). Day cells carry their state as attributes (aria-selected / data-state=today / data-outside / :disabled) plus data-weekday/data-weekend identity, so the look is fully re-skinnable off selectors. `tone` swaps which half of the palette reads brand: `default` is a self-framed neutral surface with a brand today/selection (Figma 644:1678/644:1681); `onBrand` is the Date popover's inverse (Figma 631:893/631:897).",
          slots: [
            "root",
            "search",
            "periodList",
            "period",
            "nav",
            "month",
            "week",
            "weekday",
            "grid",
            "date",
          ],
          base: {
            root: {
              display: "flex",
              flexDirection: "column",
              width: "fit-content",
              // No padding here: the search row is flush to the surface edges
              // and each `period` carries its own 8px inset, so a 3-month list
              // has no seam between columns (Figma 715:916).
            },
            search: {
              width: "token(spacing.full)",
              height: "token(spacing.4xl)",
              paddingInline: "md",
              paddingBlock: "none",
              border: "none",
              borderBottomWidth: "token(spacing.3xs)",
              borderBottomStyle: "solid",
              borderBottomColor: "field.border.default",
              background: "transparent",
              appearance: "none",
              color: "field.text.default",
              textStyle: "bodyLarge",
              caretColor: "field.text.active",
              "&::placeholder": { color: "field.text.placeholder" },
              "&::-webkit-search-cancel-button": { display: "none" },
            },
            periodList: {
              display: "flex",
              // Months are top-aligned and each is a fixed 208px column, so the
              // list simply grows 208px per month.
              alignItems: "flex-start",
              // The anchor for the two nav chevrons below.
              position: "relative",
              // The chevrons are `color: inherit` Buttons, so the list owns
              // their hue; the month labels override their own.
              color: "field.text.default",
              // Pin a nav dropped DIRECTLY in here to the matching corner, so
              // one pair flanks the whole range however many months it holds —
              // landing on the first/last month's label row (Figma 715:921 /
              // 716:1116, inset 8px, aligned to the 28px label). Scoped to the
              // list, and to direct children, so the same part nested in a
              // consumer's own chrome stays in the flow and takes their layout
              // instead of being yanked to a corner it doesn't belong to.
              "& > [data-nav]": { position: "absolute", top: "md" },
              "& > [data-nav='prev']": { left: "md" },
              "& > [data-nav='next']": { right: "md" },
            },
            period: {
              display: "flex",
              flexDirection: "column",
              // The column's own pitch — 4px between label, weekdays and grid.
              gap: "sm",
              padding: "md",
            },
            // The chevron's WRAPPER, not the chevron itself. The button is an
            // `action` recipe, and Panda emits plain recipes into
            // `@layer recipes` but slot recipes into its `recipes.slots`
            // sublayer — a parent layer's own rules always beat its sublayers,
            // so no slot style can override `action`'s `position: relative`
            // (its hover chip needs it) at any specificity. Wrapping sidesteps
            // the cascade entirely and keeps the positioning here in the recipe.
            // Placement is `periodList`'s business, not this slot's: a nav is
            // only pinned to a corner when it's dropped in a list (see above).
            nav: {
              display: "flex",
              flexShrink: 0,
              // Secondary to the month label — the glyph alone is halved, so the
              // hover chip underneath stays at full strength.
              "& svg": { opacity: 0.5, transition: "opacity 150ms ease" },
              "&:hover svg": { opacity: 1 },
            },
            month: {
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              // Matches the chevrons it sits between, so the label row is one
              // consistent 28px band across the list.
              height: "token(sizes.toolbarButton)",
              textAlign: "center",
              textStyle: "bodyLarge",
              color: "field.text.default",
            },
            week: {
              display: "grid",
              gridTemplateColumns: "repeat(7, token(sizes.calendarDay))",
              gap: "sm",
              // The header row hangs 4px below the period row (Figma 563:2722).
              paddingTop: "sm",
            },
            weekday: {
              display: "grid",
              placeItems: "center",
              width: "token(sizes.calendarDay)",
              textStyle: "bodySmall",
              color: "field.text.default",
              userSelect: "none",
              // Saturday/Sunday recede — the header's half of the same rule the
              // weekend day cells carry.
              "&[data-weekend]": { opacity: 0.5 },
            },
            grid: {
              display: "grid",
              gridTemplateColumns: "repeat(7, token(sizes.calendarDay))",
              gap: "sm",
            },
            date: {
              display: "grid",
              placeItems: "center",
              width: "token(sizes.calendarDay)",
              height: "token(sizes.calendarDay)",
              borderRadius: "sm",
              textStyle: "bodySmall",
              color: "field.text.default",
              cursor: "pointer",
              userSelect: "none",
              transition:
                "background-color 150ms ease, color 150ms ease, box-shadow 150ms ease",
              // `data-query` is the search's pending target — Enter's date. It
              // shares the hover declaration verbatim (here and in `:disabled`
              // below) so previewing a typed date reads exactly like pointing at
              // it, and an uncommittable one stays uncoloured either way.
              //
              // Selected cells opt OUT of the wash rather than merely being
              // overridden by it: the selection chip and this wash are both
              // single-attribute rules on the same slot, so which one won came
              // down to Panda's emission order — and the wash was landing last,
              // greying out the accent chip the moment you hovered a selected
              // date, or typed the date you had just committed (the query
              // survives its own Enter). Selection is the stronger state and
              // outranks the transient one no matter how the sheet is ordered.
              "&:is(:hover, [data-query]):not([aria-selected='true'])": {
                backgroundColor: "bg.itemHover",
              },
              // Weekend columns recede, matching their header — unless the cell
              // is already carrying today or the selection.
              "&[data-weekend]:not([aria-selected='true'], [data-state='today'], [data-outside])":
                { opacity: 0.5 },
              // Spill-over days are placeholders: they hold the column and show
              // their number, but the month that owns the date carries all of
              // its state, so a spill cell never draws a chip and never takes
              // the tabstop (see `Calendar.Date`). Hence a flat wash, with
              // nothing to compose against.
              "&[data-outside]": { opacity: 0.15 },
              // Today — the accent as text only, no chip.
              "&[data-state='today']": { color: "field.text.active" },
              // Selected — the accent as a translucent chip; today's colour
              // survives underneath it, so the two compose without a special
              // case (a selected today reads exactly as selected).
              "&[aria-selected='true']": {
                backgroundColor: "field.bg.active",
                color: "field.text.active",
              },
              "&:disabled": {
                color: "field.text.muted",
                opacity: 0.4,
                cursor: "not-allowed",
                "&:hover, &[data-query]": { backgroundColor: "transparent" },
              },
              "html[data-keyboard-focus] &:focus-visible": {
                boxShadow: "inset 0 0 0 1.5px var(--colors-border-focus-ring)",
              },
            },
          },
          // `tone` is a palette swap over the shared geometry above — which half
          // of the calendar reads brand, and who owns the surface.
          //
          //   default │ its OWN framed surface (field.bg/border.default, 208px);
          //           │ dates neutral, today/selected brand (Figma 644:1678 dark
          //           │ / 644:1681 light).
          //   onBrand │ dropped INTO the Date popover, which owns the surface
          //           │ (`datePopover`); the palette inverts — dates read brand,
          //           │ today/selected drop to neutral to stand out against the
          //           │ brand tint (Figma 631:893 / 631:897).
          variants: {
            tone: {
              default: {
                // The standalone calendar is a self-contained field surface, so
                // it draws its own fill + inset ring rather than leaning on
                // whatever it was dropped on. Edge as box-shadow, not border, so
                // it takes no layout and the 208px arithmetic still holds.
                root: {
                  backgroundColor: "field.bg.default",
                  borderRadius: "sm",
                  overflow: "hidden",
                  boxShadow:
                    "inset 0 0 0 0.5px var(--colors-field-border-default)",
                },
              },
              onBrand: {
                search: {
                  color: "field.text.active",
                  borderBottomColor: "field.border.active",
                  // Placeholder reads as the accent at 25%, not neutral muted
                  // (brand orange dark / pink light).
                  "&::placeholder": { color: "field.text.activeMuted" },
                },
                // Retints the chevrons, which inherit from the list (Figma
                // 563:2715/563:2719 — brand stroke at 50%).
                periodList: { color: "field.text.active" },
                month: { color: "field.text.active" },
                weekday: { color: "field.text.active" },
                date: {
                  color: "field.text.active",
                  // Today loses the accent and reads neutral (on this surface
                  // the accent IS the background).
                  "&[data-state='today']": { color: "field.text.default" },
                  // Selected = neutral chip against the brand surface.
                  "&[aria-selected='true']": {
                    backgroundColor: "field.bg.selected",
                    color: "field.text.default",
                  },
                },
              },
            },
          },
          defaultVariants: { tone: "default" },
          // CalendarRoot calls calendar({ tone }) with a runtime value.
          staticCss: [{ tone: ["*"] }],
        }),

        // The option list behind a Combobox — and a stand-alone, always-open
        // select when used on its own. Presentation only; the filtering and
        // selection live in `option-list.tsx`. Slots: `search` (the optional
        // Field.Search filter row at the top), `list` (the scrollable
        // `role=listbox` container), `option` (one `role=option` button), and
        // `empty` (the no-matches row). Option state is keyed off attributes the
        // button sets itself — `aria-selected`, `data-active` (roving/keyboard
        // highlight), `:disabled` — so the look is re-skinnable off selectors.
        // `tone` mirrors the calendar: `default` is a self-framed neutral
        // surface with a brand selected chip (Figma 647:1947/2045); `onBrand` is
        // the Combobox popover's inverse — options read brand, the selected chip
        // drops to neutral to stand out on the brand tint (Figma 629:1416/630:1702).
        optionList: defineSlotRecipe({
          className: "option-list",
          description:
            "Option list: an optional search/filter row above a scrollable listbox of option buttons on a 28px row pitch. Options carry their state as attributes (aria-selected / data-active / :disabled), so the look is fully re-skinnable off selectors. `tone` swaps which half of the palette reads brand: `default` is a self-framed neutral surface with a brand selected chip; `onBrand` drops into the Combobox popover (which owns the surface) and inverts — options brand, selected chip neutral.",
          slots: ["root", "search", "list", "option", "empty", "divider"],
          base: {
            root: {
              display: "flex",
              flexDirection: "column",
              width: "token(sizes.optionListWidth)",
              borderRadius: "sm",
              overflow: "hidden",
            },
            // A full-width Field.Search dressed as the filter row — same look as
            // the calendar's search slot (40px, 8px inset, a field-border rule
            // under it), but no negative-margin bleed since the root has no
            // padding of its own.
            search: {
              flexShrink: 0,
              width: "token(spacing.full)",
              height: "token(spacing.4xl)",
              paddingInline: "md",
              paddingBlock: "none",
              border: "none",
              borderBottomWidth: "token(spacing.3xs)",
              borderBottomStyle: "solid",
              borderBottomColor: "field.border.default",
              background: "transparent",
              appearance: "none",
              color: "field.text.default",
              textStyle: "bodyLarge",
              caretColor: "field.text.active",
              "&::placeholder": { color: "field.text.placeholder" },
              "&::-webkit-search-cancel-button": { display: "none" },
            },
            list: {
              display: "flex",
              flexDirection: "column",
              // Rows abut directly — each is its own 32px hit target, so no gap.
              gap: "none",
              padding: "sm",
              overflowX: "hidden",
              overflowY: "auto",
              // 7 full rows + a ~12px peek of the next, so the half-row signals
              // there's more to scroll (7 × 32 + 8px top/bottom padding + a 12px
              // peek = 244px — Figma 647:2386).
              maxHeight:
                "calc(7 * token(sizes.optionRow) + 2 * token(spacing.sm) + token(spacing.lg))",
            },
            option: {
              display: "flex",
              alignItems: "center",
              // Space a leading icon from the label when an option composes both.
              gap: "md",
              width: "token(spacing.full)",
              flexShrink: 0,
              // Hug the content — the 4px inset alone defines the row/chip box
              // (Figma 647:2387 `p-[4px]`); no fixed height, so an icon-only
              // toolbar chip is 20px + 8px = 28px and a text row is its line-box
              // + 8px, rather than everything forced to a 32px track.
              padding: "sm",
              borderRadius: "sm",
              border: "none",
              background: "transparent",
              appearance: "none",
              textAlign: "left",
              textStyle: "bodySmall",
              color: "field.text.default",
              cursor: "pointer",
              userSelect: "none",
              // Single line, truncated with an ellipsis.
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              // A composed leading icon: fixed 20px box, inherits the row colour
              // (so it tracks selected/active) via currentColor.
              "& svg": {
                width: "token(spacing.xxl)",
                height: "token(spacing.xxl)",
                flexShrink: 0,
                display: "block",
              },
              "& svg path[stroke]": { stroke: "currentColor" },
              "& svg path[fill]": { fill: "currentColor" },
              transition:
                "background-color 150ms ease, color 150ms ease, box-shadow 150ms ease",
              // `data-active` is the roving/keyboard highlight; it shares the
              // hover declaration verbatim so arrowing onto a row reads exactly
              // like pointing at it (and a disabled row stays uncoloured either
              // way, mirroring the calendar's day cells). The `:not` excludes the
              // selected row: it's the default roving highlight, so it carries
              // BOTH `data-active` and `aria-selected` — without the guard the
              // neutral hover tint would win over the brand selected chip (equal
              // specificity → atomic-CSS order decides), leaving selection grey.
              "&:hover:not([aria-selected='true']):not([aria-pressed='true']), &[data-active]:not([aria-selected='true']):not([aria-pressed='true'])":
                { backgroundColor: "field.bg.hover" },
              // The single "on" state — a listbox's selected row and a toolbar's
              // pressed toggle share the brand chip (full-converge: one item skin
              // whether the row is picked or the toggle is on).
              "&[aria-selected='true'], &[aria-pressed='true']": {
                backgroundColor: "field.bg.active",
                color: "field.text.active",
              },
              "&:disabled": {
                color: "field.text.muted",
                opacity: 0.4,
                cursor: "not-allowed",
                "&:hover, &[data-active]": { backgroundColor: "transparent" },
              },
              "html[data-keyboard-focus] &:focus-visible": {
                boxShadow: "inset 0 0 0 1.5px var(--colors-border-focus-ring)",
              },
            },
            empty: {
              display: "flex",
              alignItems: "center",
              height: "token(sizes.optionRow)",
              paddingInline: "sm",
              textStyle: "bodySmall",
              color: "field.text.muted",
              userSelect: "none",
            },
            // Separates option groups (Menu.Group's old divider). Block = a
            // horizontal hairline; the inline variant flips it vertical.
            divider: {
              flexShrink: 0,
              backgroundColor: "border.divider",
              width: "token(spacing.full)",
              height: "token(spacing.xxs)",
            },
          },
          variants: {
            tone: {
              default: {
                // Self-contained field surface — its own fill + inset ring, like
                // the calendar's default tone (edge as a box-shadow so it takes
                // no layout and the width arithmetic holds).
                root: {
                  backgroundColor: "field.bg.default",
                  boxShadow:
                    "inset 0 0 0 0.5px var(--colors-field-border-default)",
                },
              },
              onBrand: {
                // Dropped INTO the Combobox popover, which owns the surface — so
                // the root just fills it and the palette inverts.
                root: { width: "token(spacing.full)" },
                search: {
                  color: "field.text.active",
                  borderBottomColor: "field.border.active",
                  "&::placeholder": { color: "field.text.activeMuted" },
                },
                option: {
                  color: "field.text.active",
                  // Same selected-row guard as the base tone (see there): keep the
                  // neutral selected chip from being overridden by the brand hover
                  // tint on the row that is both highlighted and selected.
                  "&:hover:not([aria-selected='true']):not([aria-pressed='true']), &[data-active]:not([aria-selected='true']):not([aria-pressed='true'])":
                    { backgroundColor: "field.bg.hoverBrand" },
                  // On (selected or pressed) = neutral chip against the brand surface.
                  "&[aria-selected='true'], &[aria-pressed='true']": {
                    backgroundColor: "field.bg.selected",
                    color: "field.text.default",
                  },
                  "&:disabled": {
                    "&:hover, &[data-active]": {
                      backgroundColor: "transparent",
                    },
                  },
                },
                empty: { color: "field.text.activeMuted" },
              },
              plain: {
                // For a menu whose Popover already owns the surface (the slash
                // menu). The neutral sibling of onBrand — but here the root also
                // COLLAPSES (display:contents), so the listbox sits directly in the
                // popover with no wrapper div and no inset of its own; the list's
                // 4px padding is the only gap. Keeps the default option palette.
                root: { display: "contents" },
              },
            },
            direction: {
              // Block (default) is the vertical list already encoded in the base.
              block: {},
              // Inline is a row — toolbars and horizontal single-selects. The
              // root collapses (display:contents) so the options sit directly in
              // the consumer's frame (e.g. selectionPopover), which owns the pill
              // surface; the option becomes a content-width chip.
              inline: {
                root: { display: "contents" },
                list: {
                  flexDirection: "row",
                  alignItems: "center",
                  gap: "xs",
                  maxHeight: "none",
                  overflow: "visible",
                  width: "max-content",
                  padding: "none",
                },
                option: { width: "auto" },
                divider: {
                  width: "token(spacing.xxs)",
                  height: "auto",
                  alignSelf: "stretch",
                },
              },
            },
          },
          defaultVariants: { tone: "default", direction: "block" },
          // OptionListRoot calls optionList({ tone, direction }) at runtime.
          staticCss: [{ tone: ["*"], direction: ["*"] }],
        }),

        notice: defineSlotRecipe({
          className: "notice",
          description:
            "Notice — an inline informational callout: a leading status icon beside a short run of prose on a subtle neutral wash (bg.notice), composed as Notice > Notice.Icon + Notice.Label (Figma 684:1045 dark, 704:1710 light). The root owns the fill, the row layout, and the single `color` source (field.text.default — the field family's resting accent) that the icon and any emphasized runs inherit; the label dials its own body prose back to 75% so the emphasized dates/days it wraps in <strong> read as the salient bits. Purely presentational — no state, no variants — so it stays a Server Component.",
          slots: ["root", "icon", "label"],
          base: {
            root: {
              display: "flex",
              alignItems: "flex-start",
              gap: "xs",
              width: "token(spacing.full)",
              paddingInline: "sm",
              paddingBlock: "md",
              borderRadius: "sm",
              backgroundColor: "bg.notice",
              // One source for the icon + emphasized runs; the label overrides
              // its own body prose to 75% off this so the <strong> bits pop.
              color: "field.text.default",
            },
            icon: {
              flexShrink: 0,
              display: "block",
              width: "token(spacing.xxl)",
              height: "token(spacing.xxl)",
              // A composed icon fills the 20px box and tracks the notice colour
              // via currentColor (mirrors the action / option recipes).
              "& svg": {
                width: "token(spacing.full)",
                height: "token(spacing.full)",
                display: "block",
              },
              "& svg path[stroke], & svg circle[stroke]": {
                stroke: "currentColor",
              },
              "& svg path[fill], & svg circle[fill]": { fill: "currentColor" },
            },
            label: {
              flex: "1 1 0",
              minWidth: 0,
              textStyle: "sidenote",
              // Body prose sits a step below the accent; the emphasized runs
              // (dates, weekdays) step back up to full colour + a heavier weight,
              // matching the Figma's Regular → Semibold shift.
              color: "field.text.default/75",
              wordBreak: "break-word",
              "& :is(strong, b)": {
                color: "field.text.default",
                fontWeight: "bold",
              },
            },
          },
        }),
      },

      textStyles: {
        title: {
          value: {
            fontFamily: "{fonts.switzer}",
            fontWeight: "{fontWeights.base}",
            fontSize: "2rem",
            lineHeight: "1.5",
            letterSpacing: "-1.5%",
          },
        },
        subheading: {
          value: {
            fontFamily: "{fonts.switzer}",
            fontWeight: "{fontWeights.base}",
            fontSize: "1.25rem",
            lineHeight: "1.8",
          },
        },
        bodyLarge: {
          value: {
            fontFamily: "{fonts.switzer}",
            fontWeight: "{fontWeights.base}",
            fontSize: "1rem",
            lineHeight: "1.75",
          },
        },
        quote: {
          value: {
            fontFamily: "{fonts.switzer}",
            fontWeight: "{fontWeights.base}",
            fontSize: "1.25rem",
            lineHeight: "1.8",
            letterSpacing: "-1%",
          },
        },
        caption: {
          value: {
            fontFamily: "{fonts.switzer}",
            fontWeight: "{fontWeights.base}",
            fontSize: "0.75rem",
            lineHeight: "2",
            letterSpacing: "0.5%",
          },
        },
        sidenote: {
          value: {
            fontFamily: "{fonts.switzer}",
            fontWeight: "{fontWeights.base}",
            fontSize: "0.75rem",
            lineHeight: "1.67",
            letterSpacing: "0.5%",
          },
        },
        bodySmall: {
          value: {
            fontFamily: "{fonts.switzer}",
            fontWeight: "{fontWeights.base}",
            fontSize: "0.875rem",
            lineHeight: "1.72",
          },
        },
        inlineCode: {
          value: {
            fontFamily: "{fonts.jetbrainsMono}",
            fontSize: "0.875em",
          },
        },
        code: {
          value: {
            fontFamily: "{fonts.jetbrainsMono}",
            fontSize: "0.875rem",
            lineHeight: "1.72",
          },
        },
      },
    },
  },

  outdir: "styled-system",
});
