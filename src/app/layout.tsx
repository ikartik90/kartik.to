import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import "@/lib/env";
import { Analytics } from "@/components/analytics";
import { ContentSyncProvider } from "@/components/content-sync-provider";
import { Header } from "@/components/header";
import { KeyboardFocusProvider } from "@/components/keyboard-focus-provider";
import { AdminLoginBootstrap } from "@/components/admin-login-bootstrap";
import { CommandPalette } from "@/components/command-palette";
import { ThemeProvider } from "@/components/theme-provider";
import { SITE_DESCRIPTION, SITE_LOCALE, SITE_NAME } from "@/data/site";
import { SITE_URL } from "@/lib/site-url";
import { PALETTE_INTENT_SCRIPT } from "@/utils/palette-intent";

const switzer = localFont({
  src: "../../public/fonts/Switzer-Variable.woff2",
  variable: "--font-switzer",
  display: "swap",
});

const jetbrainsMono = localFont({
  src: "../../public/fonts/JetBrainsMono-Regular.woff2",
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  // What every relative URL in this app's metadata resolves against, and the
  // reason the site had no link previews at all: `og:image` and `og:url` are
  // read by crawlers, which have no page to resolve a path against, so Next
  // drops a relative one entirely rather than emitting something that cannot
  // be fetched. Without a base there was nothing to make absolute.
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_NAME,
    // Every page below states its own name and gets the site's after it. The
    // homepage keeps `default`, which is the site's name alone rather than the
    // site's name twice.
    template: `%s — ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  // The defaults every page inherits and each post then overrides with its own
  // title, description and card. The image is not named here: the file
  // convention supplies it — `app/opengraph-image.tsx` for anything with
  // nothing more specific, and a post's own route for a post.
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    locale: SITE_LOCALE,
    url: SITE_URL,
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
  },
  twitter: {
    // The large card, because what is being shared is a PICTURE of the post's
    // tile — at `summary` it is cropped to a square thumbnail beside the text,
    // which throws away the half of the card that is the cover.
    card: "summary_large_image",
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
  },
};

// Runs synchronously before hydration to prevent flash of incorrect theme.
// Reads the Zustand-persisted mode from localStorage and sets data-theme on <html>.
const themeScript = `(function(){try{var s=localStorage.getItem('theme');var m=s?JSON.parse(s).state?.mode:'system';var t=m==='dark'?'dark':m==='light'?'light':window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';document.documentElement.setAttribute('data-theme',t)}catch(e){}})()`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${switzer.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* Raw synchronous inline script — must run before first paint to
            avoid FOUC. next/script beforeInteractive queues via __next_s and
            fires after the client runtime loads, too late. */}
        <script
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: themeScript }}
        />
        {/* Also synchronous, and for the same reason: the palette's own ⌘K
            listener does not exist until the layout hydrates, so a press
            before then is dropped. This one records it; the palette collects
            it on mount (see palette-intent.ts). */}
        <script
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: PALETTE_INTENT_SCRIPT }}
        />
      </head>
      <body>
        <ThemeProvider />
        <ContentSyncProvider />
        <KeyboardFocusProvider />
        <AdminLoginBootstrap />
        <CommandPalette />
        <Header />
        {children}
        {/* Last, and rendering nothing: both clients only attach a deferred
            script. See analytics.tsx for why the admin surface is filtered. */}
        <Analytics />
      </body>
    </html>
  );
}
