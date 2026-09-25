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
import { AUTHOR, SITE_DESCRIPTION, SITE_NAME, SITE_TITLE } from "@/data/site";
import { siteCard } from "@/lib/post-metadata";
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
  // Without a base, Next drops relative og:image / og:url entirely.
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_TITLE,
    template: `%s — ${AUTHOR.name}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  authors: [{ name: AUTHOR.name, url: SITE_URL }],
  creator: AUTHOR.name,
  publisher: AUTHOR.name,
  ...siteCard(SITE_DESCRIPTION),
};

// Sets data-theme from the persisted mode before first paint.
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
        {/* Raw inline script: next/script's beforeInteractive runs too late to prevent a theme flash. */}
        <script
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: themeScript }}
        />
        {/* Records a ⌘K pressed before hydration; the palette collects it on mount. */}
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
        <Analytics />
      </body>
    </html>
  );
}
