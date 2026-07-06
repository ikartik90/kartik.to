import { defineConfig, defineRecipe } from "@pandacss/dev";

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
          dialogFooter: { value: "44px" },
          quoteMark: { value: "52px" },
          tooltipIcon: { value: "14px" },
        },

        colors: {
          neutral: {
            100: { value: "#EEF2F6" },
            200: { value: "#CFD9E2" },
            300: { value: "#A9BFD6" },
            600: { value: "#576675" },
            700: { value: "#414244" },
            800: { value: "#2E3338" },
            900: { value: "#1F2123" },
          },
          brand: {
            orange: { value: "#FFAB6F" },
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
          // dialogPanel content-box top corners: outer radii.md − border 3xs
          dialogInner: {
            value: "calc(var(--radii-md) - var(--spacing-3xs))",
          },
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
                "color-mix(in srgb, var(--colors-neutral-600) 25%, transparent)",
            },
            button: {
              secondary: {
                default: {
                  value:
                    "color-mix(in srgb, var(--colors-neutral-600) 25%, transparent)",
                },
                hover: {
                  value:
                    "color-mix(in srgb, var(--colors-neutral-600) 50%, transparent)",
                },
              },
              tertiary: {
                hover: {
                  value:
                    "color-mix(in srgb, var(--colors-neutral-600) 25%, transparent)",
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
              value:
                "linear-gradient(135deg, {colors.brand.pink} 0%, {colors.brand.orange} 100%)",
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
            paragraph: {
              value: {
                base: "{colors.neutral.600}",
                _dark: "{colors.neutral.300}",
              },
            },
            // Only readable over bg.brandedEmphasis (the gradient) — same in both themes
            brandedEmphasis: {
              value: "{colors.neutral.900}",
            },
            selection: {
              value: "{colors.neutral.900}",
            },
            // Command palette item labels — lighter than text.default in dark mode
            commandItem: {
              value: {
                base: "{colors.neutral.700}",
                _dark: "{colors.neutral.300}",
              },
            },
          },

          border: {
            divider: {
              value:
                "color-mix(in srgb, var(--colors-neutral-600) 25%, transparent)",
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
                base: "{colors.neutral.600}",
                _dark: "{colors.neutral.300}",
              },
            },
          },
        },
      },

      recipes: {
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
          description: "Hyperlink inside article prose.",
          base: {
            textStyle: "link",
            color: "text.default",
            transition: "color 150ms ease",
            _hover: { color: "text.title" },
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
          defaultVariants: {
            aspectRatio: "sm",
          },
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
              log: { color: "text.commandItem" },
              info: { color: "text.commandItem" },
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
            textStyle: "commandItem",
            color: "text.commandItem",
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
          description: "Upload progress bar track and fill.",
          base: {
            position: "relative",
            width: "token(sizes.imagePreviewMax)",
            height: "token(spacing.xxs)",
            borderRadius: "xs",
            backgroundColor: "border.divider",
            overflow: "hidden",
          },
        }),

        mediaLibrarySidebar: defineRecipe({
          className: "media-library-sidebar",
          description: "Image library sidebar in insert-image dialog.",
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
            overflowY: "auto",
          },
        }),

        mediaLibraryItem: defineRecipe({
          className: "media-library-item",
          description: "Selectable row in the image library sidebar.",
          base: {
            display: "flex",
            alignItems: "center",
            width: "100%",
            gap: "md",
            height: "token(spacing.3xl)",
            paddingInline: "md",
            borderRadius: "sm",
            border: "none",
            background: "none",
            cursor: "pointer",
            textStyle: "commandItem",
            color: "text.commandItem",
            textAlign: "left",
            "&[aria-selected='true']": {
              backgroundColor: "bg.itemHover",
            },
          },
        }),

        mediaPreview: defineRecipe({
          className: "media-preview",
          description: "Large image preview in insert-image library view.",
          base: {
            width: "token(sizes.imagePreviewMax)",
            height: "token(sizes.imagePreviewMax)",
            flexShrink: 0,
            margin: "none",
            "& img": {
              width: "100%",
              height: "100%",
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
            paddingInline: "sm",
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
            textStyle: "commandLabel",
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
            "Theme-aware quote mark at native PNG resolution (52×52 @1x).",
          base: {
            width: "token(sizes.quoteMark)",
            height: "token(sizes.quoteMark)",
            flexShrink: 0,
            pointerEvents: "none",
          },
          variants: {
            theme: {
              light: {
                display: "block",
                _dark: { display: "none" },
              },
              dark: {
                display: "none",
                _dark: { display: "block" },
              },
            },
          },
        }),

        articleBlockquote: defineRecipe({
          className: "article-blockquote",
          description: "Blockquote typography inside article prose.",
          base: {
            flex: "1 1 auto",
            minWidth: 0,
            textStyle: "quote",
            color: "text.default",
            wordBreak: "break-word",
            paddingBlockStart: "xl",
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

        slashMenuSubmenu: defineRecipe({
          className: "slash-menu-submenu",
          description:
            "Slash menu submenu — positioned beside the parent popover via slash-menu.tsx.",
          base: {
            position: "absolute",
            zIndex: 51,
            width: "200px",
            backgroundColor: "bg.surface",
            borderRadius: "md",
            borderWidth: "token(spacing.3xs)",
            borderStyle: "solid",
            borderColor: "border.divider",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            paddingBlock: "md",
            paddingInline: "sm",
            gap: "xs",
            boxShadow:
              "0 4px 16px color-mix(in srgb, var(--colors-neutral-900) 12%, transparent)",
          },
        }),

        slashMenuPopover: defineRecipe({
          className: "slash-menu-popover",
          description:
            "Slash menu — positioned with CSS anchor() against the active block's anchor-name.",
          base: {
            position: "absolute",
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
            paddingBlock: "md",
            paddingInline: "sm",
            gap: "xs",
            boxShadow:
              "0 4px 16px color-mix(in srgb, var(--colors-neutral-900) 12%, transparent)",
          },
        }),

        socialTooltip: defineRecipe({
          className: "social-tooltip",
          description:
            "Social link hover tooltip — Figma node 389:318 (20px tall, 4px padding/gap).",
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
            backgroundColor: "bg.button.tertiary.hover",
            color: "text.commandItem",
            textStyle: "commandLabel",
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
          },
        }),

        socialTooltipIcon: defineRecipe({
          className: "social-tooltip-icon",
          description:
            "Icons inside social link tooltips — fixed 14px size, never shrinks.",
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
            textStyle: "commandItem",
            color: "text.commandItem",
            // cmdk sets data-selected; slash-menu uses aria-selected on native buttons
            "&[data-selected='true'], &[aria-selected='true']": {
              backgroundColor: "bg.itemHover",
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
        paragraph: {
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
        commandItem: {
          value: {
            fontFamily: "{fonts.switzer}",
            fontWeight: "{fontWeights.base}",
            fontSize: "0.875rem",
            lineHeight: "1.5rem",
          },
        },
        commandLabel: {
          value: {
            fontFamily: "{fonts.switzer}",
            fontWeight: "{fontWeights.base}",
            fontSize: "0.75rem",
            lineHeight: "1.25rem",
          },
        },
        inlineCode: {
          value: {
            fontFamily: "{fonts.jetbrainsMono}",
            fontSize: "0.875em",
          },
        },
        link: {
          value: {
            textDecoration: "underline",
            textUnderlineOffset: "3px",
          },
        },
        code: {
          value: {
            fontFamily: "{fonts.jetbrainsMono}",
            fontSize: "0.875rem",
            lineHeight: "1.7",
          },
        },
      },
    },
  },

  outdir: "styled-system",
});
