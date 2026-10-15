import { useSyncExternalStore } from "react";

function subscribeNoop() {
  return () => {};
}

/** True only on the client — avoids hydration mismatches and effect setState. */
export function useIsClient(): boolean {
  return useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false,
  );
}
