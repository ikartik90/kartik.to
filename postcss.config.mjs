// Panda's plugin fills globals.css with the whole stylesheet in dev. A build gives each page its own instead, written
// by scripts/page-styles, which the plugin would fill with the whole one again.
const config = {
  plugins: process.env.NODE_ENV === "production" ? {} : { "@pandacss/dev/postcss": {} },
};

export default config;
