"use client";

import { useEffect } from "react";
import { authClient } from "@/lib/auth/client";

declare global {
  interface Window {
    adminLogin?: () => void;
  }
}

const LOGIN_PENDING_KEY = "adminLoginPending";

export function AdminLoginBootstrap() {
  useEffect(() => {
    const pending = sessionStorage.getItem(LOGIN_PENDING_KEY);
    if (pending) {
      sessionStorage.removeItem(LOGIN_PENDING_KEY);
      authClient
        .getSession()
        .then(({ data }) => {
          if (data?.user) console.log("Login successful!");
        })
        .catch((err: unknown) => {
          console.error("[adminLogin] getSession error:", err);
        });
    }

    window.adminLogin = () => {
      sessionStorage.setItem(LOGIN_PENDING_KEY, "1");
      authClient.signIn.social({ provider: "github", callbackURL: "/" });
    };

    return () => {
      delete window.adminLogin;
    };
  }, []);

  return null;
}
