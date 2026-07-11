import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import "@/lib/env";
import { ContentSyncProvider } from "@/components/content-sync-provider";
import { Header } from "@/components/header";
import { KeyboardFocusProvider } from "@/components/keyboard-focus-provider";
import { AdminLoginBootstrap } from "@/components/admin-login-bootstrap";
import { CommandPalette } from "@/components/command-palette";
import { ThemeProvider } from "@/components/theme-provider";

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
  title: "kartik.to",
  description: "Kartik Iyer's digital design portfolio and blog.",
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
        {/* eslint-disable-next-line @next/next/no-before-interactive-script-outside-document */}
        <script
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: themeScript }}
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
      </body>
    </html>
  );
}
