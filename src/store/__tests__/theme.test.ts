// Tests for theme store helpers.
// TODO: add a test runner (vitest or jest) to execute these.

import { resolveTheme } from "../theme";

export function testResolveLight() {
  const result = resolveTheme("light");
  console.assert(result === "light", "resolveTheme('light') should return 'light'");
}

export function testResolveDark() {
  const result = resolveTheme("dark");
  console.assert(result === "dark", "resolveTheme('dark') should return 'dark'");
}
