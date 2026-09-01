// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";

// The server action is the piece under contract here: this module's whole job
// is to ask it where to go and then go there, so the action is stood in for and
// the going is watched.
const { mockStartAdminLogin } = vi.hoisted(() => ({
  mockStartAdminLogin: vi.fn(),
}));

vi.mock("@/app/actions/auth", () => ({
  startAdminLogin: () => mockStartAdminLogin(),
}));

const { ADMIN_LOGIN_PENDING_KEY, adminLogin } = await import("../admin-login");

const OAUTH_URL = "https://github.com/login/oauth/authorize?client_id=abc";

// jsdom refuses to redefine `location.assign` in place, so the whole object is
// swapped for one that records where it was sent.
let assign: ReturnType<typeof vi.fn>;

describe("adminLogin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    assign = vi.fn();
    Object.defineProperty(window, "location", {
      configurable: true,
      writable: true,
      value: { href: "http://localhost/", assign },
    });
    window.sessionStorage.clear();
    mockStartAdminLogin.mockResolvedValue(OAUTH_URL);
  });

  it("asks the server where to go, and sends the browser there", async () => {
    await adminLogin();

    expect(mockStartAdminLogin).toHaveBeenCalledTimes(1);
    expect(assign).toHaveBeenCalledWith(OAUTH_URL);
  });

  it("marks the trip, so the return leg knows a login was asked for", async () => {
    await adminLogin();

    expect(window.sessionStorage.getItem(ADMIN_LOGIN_PENDING_KEY)).toBe("1");
  });

  it("goes nowhere when the server cannot start the handshake", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockStartAdminLogin.mockRejectedValue(new Error("no provider"));

    await adminLogin();

    expect(assign).not.toHaveBeenCalled();
  });

  it("leaves no mark behind when the handshake never started", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockStartAdminLogin.mockRejectedValue(new Error("no provider"));

    await adminLogin();

    expect(window.sessionStorage.getItem(ADMIN_LOGIN_PENDING_KEY)).toBeNull();
  });

  it("reports the failure rather than swallowing it", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    mockStartAdminLogin.mockRejectedValue(new Error("no provider"));

    await adminLogin();

    expect(error).toHaveBeenCalled();
  });
});
