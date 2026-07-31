import { expect, test } from "./fixtures";

/**
 * The stealth gate in `src/proxy.ts` is the one invariant on this site whose
 * failure is a security bug rather than a cosmetic one, and it is enforced in
 * middleware — which only runs in a real deployment. This is exactly the class
 * of regression a jsdom unit test cannot see.
 */
test.describe("admin stealth gate", () => {
  // Redirects are followed deliberately. `/admin/` answers 308 on the first
  // hop, but so does every trailing-slash URL whether or not the route exists
  // (Next normalises the path before the proxy sees it), so that hop carries no
  // information — only the settled status does.
  for (const path of ["/admin", "/admin/", "/admin/posts", "/admin/anything"]) {
    test(`${path} settles on 404 for an anonymous request`, async ({
      request,
    }) => {
      const response = await request.get(path);

      // 404, never 401/403 and never a redirect to a login screen — an
      // auth-shaped response confirms the route exists, which is the whole
      // thing the mask prevents.
      expect(response.status()).toBe(404);
    });
  }

  test("a forged session cookie does not unlock the route", async ({
    request,
  }) => {
    const response = await request.get("/admin", {
      headers: {
        cookie: "__Secure-neon-auth.local.session_data=not-a-valid-jwt",
      },
    });

    expect(response.status()).toBe(404);
  });
});
