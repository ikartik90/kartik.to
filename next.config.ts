import type { NextConfig } from "next";
import { LISTED_CATEGORIES, POST_CATEGORIES } from "./src/data/post-categories";

const svgrOptions = {
  // SVGO turns colour names into hex before this runs, so match the hex.
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
        source: "/:path*",
        has: [{ type: "host", value: "www\\.(?<domain>.+)" }],
        destination: "https://:domain/:path*",
        permanent: true,
      },
    ];
  },

  async rewrites() {
    // Maps `<post>.md` onto the `md` route before `[slug]` claims it; a segment cannot be named `[slug].md`.
    return [
      ...LISTED_CATEGORIES.map((category) => {
        const { path } = POST_CATEGORIES[category];
        return { source: `${path}/:slug.md`, destination: `${path}/:slug/md` };
      }),
      { source: "/about.md", destination: "/about/md" },
    ];
  },

  // Satori cannot render without this font, so it is forced into the trace.
  outputFileTracingIncludes: {
    "/**/opengraph-image": ["./public/fonts/Switzer-Variable.woff"],
  },

  turbopack: {
    rules: {
      "*.svg": {
        loaders: [{ loader: "@svgr/webpack", options: svgrOptions }],
        as: "*.js",
      },
    },
  },

  webpack(config) {
    const fileLoaderRule = config.module.rules.find(
      (rule: { test?: { test?: (s: string) => boolean } }) =>
        rule.test?.test?.(".svg"),
    );

    config.module.rules.push(
      { ...fileLoaderRule, test: /\.svg$/i, resourceQuery: /url/ },
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
