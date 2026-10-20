"use client";

import { useSyncExternalStore } from "react";

const subscribeNever = () => () => {};

/**
 * A value only the browser knows (WebAuthn support, the device's time zone…),
 * with a fixed fallback while server-rendering and hydrating. `get` must
 * return the same value on every call (cache objects).
 */
export function useClientValue<T>(get: () => T, serverValue: T): T {
  return useSyncExternalStore(subscribeNever, get, () => serverValue);
}
