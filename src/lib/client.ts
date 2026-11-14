import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

// False while the page is prerendered at build time and while it hydrates, true in the browser.
// Screens use it so that localStorage, new Date() and window are only read in the browser.
export const useIsClient = () =>
  useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
