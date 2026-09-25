"use client";

import { useEffect } from "react";
import { authClient } from "@/lib/auth/client";
import { ADMIN_LOGIN_PENDING_KEY, adminLogin } from "@/utils/admin-login";

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
