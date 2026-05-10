"use client";

import { useEffect } from "react";

declare global {
  interface Window {
    adminLogin?: () => void;
  }
}

export function AdminLoginBootstrap() {
  useEffect(() => {
    window.adminLogin = () => {
      window.location.assign("/auth/sign-in");
    };

    return () => {
      delete window.adminLogin;
    };
  }, []);

  return null;
}
