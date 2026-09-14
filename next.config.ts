import type { NextConfig } from "next";

const svgrOptions = {
  // SVGO normalises colour names to hex before replaceAttrValues runs, so
  // match the post-SVGO hex value rather than the original keyword.
  replaceAttrValues: { "#fff": "currentColor", "#ffffff": "currentColor" },
  svgoConfig: {
    plugins: [
      {
        name: "preset-default",
        params: {
          overrides: {
            removeViewBox: false,
          },
        },
      },
    ],
  },
};

const nextConfig: NextConfig = {
  images: {
    qualities: [100],
  },

  async redirects() {
    return [
      {
        // `www.kartik.to` served a second, identical copy of the whole site,
        // and search engines split what little credit the site had between the
        // two. Every `www.` host now answers with a permanent redirect to the
        // same path on the bare domain.
        source: "/:path*",
        has: [{ type: "host", value: "www\\.(?<domain>.+)" }],
        destination: "https://:domain/:path*",
        permanent: true,
      },
      {
        // The project's first slug, from before it was named for what it is.
        // It was already live and indexed, so the old address — and its card
        // and Markdown copy under it — keeps working.
        source: "/work/scheduling-extensions/:path*",
        destination: "/work/redesigning-shift-scheduling/:path*",
        permanent: true,
      },
    ];
  },

  async rewrites() {
    // A post's Markdown copy lives at its own address with `.md` appended, the
    // `llms.txt` convention. A segment cannot be named `[slug].md`, so the
    // handler is an `md` route beside the page and this maps the address onto
    // it — before the dynamic `[slug]` page can claim `scheduling.md` as a slug.
    return [
      { source: "/work/:slug.md", destination: "/work/:slug/md" },
      { source: "/writing/:slug.md", destination: "/writing/:slug/md" },
    ];
  },

  // The typeface every Open Graph card is set in, stated explicitly so it
  // reaches the functions that draw one.
  //
  // Satori has no stylesheet and no `next/font`; it is handed font BYTES, and
  // `src/lib/og/card.tsx` reads them off the filesystem at request time. Which
  // files a serverless function's filesystem actually contains is decided by
  // Next's tracing, and tracing infers that from static analysis of the code —
  // it does handle `join(process.cwd(), "<literal>")`, but a missing font here
  // is not a degraded card, it is no card at all: Satori refuses to render
  // without one. So the trace is told rather than trusted.
  //
  // The glob covers `app/opengraph-image` and both `[slug]` routes under it.
  outputFileTracingIncludes: {
    "/**/opengraph-image": ["./public/fonts/Switzer-Variable.woff"],
  },

  // Turbopack (default in Next.js 16)
  turbopack: {
    rules: {
      "*.svg": {
        loaders: [{ loader: "@svgr/webpack", options: svgrOptions }],
        as: "*.js",
      },
    },
  },

  // Webpack (next dev --webpack / next build --webpack)
  webpack(config) {
    const fileLoaderRule = config.module.rules.find(
      (rule: { test?: { test?: (s: string) => boolean } }) =>
        rule.test?.test?.(".svg"),
    );

    config.module.rules.push(
      // Reapply the existing rule, but only for svg imports ending in ?url
      { ...fileLoaderRule, test: /\.svg$/i, resourceQuery: /url/ },
      // Convert all other *.svg imports to React components
      {
        test: /\.svg$/i,
        issuer: fileLoaderRule?.issuer,
        resourceQuery: {
          not: [...(fileLoaderRule?.resourceQuery?.not ?? []), /url/],
        },
        use: [{ loader: "@svgr/webpack", options: svgrOptions }],
      },
    );

    fileLoaderRule.exclude = /\.svg$/i;
    return config;
  },
};

export default nextConfig;
