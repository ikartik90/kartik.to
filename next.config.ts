import type { NextConfig } from "next";

const svgrOptions = {
  // SVGO normalises colour names to hex before replaceAttrValues runs, so
  // match the post-SVGO hex value rather than the original keyword.
  replaceAttrValues: { "#fff": "currentColor" },
};

const nextConfig: NextConfig = {
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
        resourceQuery: { not: [...(fileLoaderRule?.resourceQuery?.not ?? []), /url/] },
        use: [{ loader: "@svgr/webpack", options: svgrOptions }],
      },
    );

    fileLoaderRule.exclude = /\.svg$/i;
    return config;
  },
};

export default nextConfig;
