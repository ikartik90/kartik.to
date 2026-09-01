"use client";

import { useEffect } from "react";
import { authClient } from "@/lib/auth/client";
import { ADMIN_LOGIN_PENDING_KEY, adminLogin } from "@/utils/admin-login";

// ---------------------------------------------------------------------------
// The console half of signing in.
//
// Hangs `adminLogin` off `window` so the author can call it by hand, and
// reports the outcome once the browser lands back here. The going-away half is
// `utils/admin-login.ts`, shared with the palette's `> window.adminLogin()`
// row — this component only owns the console handle and the return leg, which
// has to live in a component because the page that asked for the login no
// longer exists to be told how it went.
// ---------------------------------------------------------------------------

declare global {
  interface Window {
    adminLogin?: () => void;
  }
}

export function AdminLoginBootstrap() {
  useEffect(() => {
    const pending = sessionStorage.getItem(ADMIN_LOGIN_PENDING_KEY);
    if (pending) {
      sessionStorage.removeItem(ADMIN_LOGIN_PENDING_KEY);
      authClient
        .getSession()
        .then(({ data }) => {
          if (data?.user) console.log("Login successful!");
        })
        .catch((err: unknown) => {
          console.error("[adminLogin] getSession error:", err);
        });
    }

    window.adminLogin = () => void adminLogin();

    return () => {
      delete window.adminLogin;
    };
  }, []);

  return null;
}
