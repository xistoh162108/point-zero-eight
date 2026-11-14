import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

// False while prerendering and hydrating, true in the browser afterwards.
// Pages use it to read device storage without a hydration mismatch.
export function useMounted(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
