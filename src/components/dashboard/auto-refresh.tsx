"use client";

import { useEffect } from "react";

export function AutoRefresh({ intervalSeconds = 20 }: { intervalSeconds?: number }) {
  useEffect(() => {
    const timer = window.setInterval(() => {
      window.location.reload();
    }, intervalSeconds * 1000);

    return () => window.clearInterval(timer);
  }, [intervalSeconds]);

  return null;
}
