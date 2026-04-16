"use client";

import { useEffect } from "react";

export default function PwaInit() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .catch(() => {/* ignore registration errors in dev */});
    }
  }, []);

  return null;
}
