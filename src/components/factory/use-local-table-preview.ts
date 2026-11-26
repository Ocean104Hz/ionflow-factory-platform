"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};
const serverSnapshot = () => false;
const localDevelopment = () => process.env.NODE_ENV === "development" &&
  ["localhost", "127.0.0.1", "[::1]"].includes(window.location.hostname);

export function useLocalTablePreview() {
  return useSyncExternalStore(subscribe, localDevelopment, serverSnapshot);
}
