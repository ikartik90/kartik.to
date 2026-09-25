import { expect, test } from "./fixtures";

test.describe("admin stealth gate", () => {
  // Redirects are followed: every trailing-slash URL 308s first, so only the settled status counts.
  for (const path of ["/admin", "/admin/", "/admin/posts", "/admin/anything"]) {
    test(`${path} settles on 404 for an anonymous request`, async ({
      request,
    }) => {
      const response = await request.get(path);

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
