"use client";

import { useEffect } from "react";

/**
 * Root error boundary — must render its own html/body (replaces root layout).
 * Keep styling self-contained; brand tokens mirrored as inline hex.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("MARDALANI global error", error.digest ?? error.name);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "center",
          padding: "3rem 1.25rem",
          fontFamily:
            '"Plus Jakarta Sans", system-ui, -apple-system, sans-serif',
          background: "#F7F4EC",
          color: "#252A27",
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: "0.8125rem",
            fontWeight: 600,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "#C9A96E",
          }}
        >
          MARDALANI
        </p>
        <h1
          style={{
            margin: "0.75rem 0 0",
            maxWidth: "28rem",
            fontFamily: "Fraunces, Georgia, serif",
            fontSize: "clamp(1.75rem, 4vw, 2.5rem)",
            fontWeight: 600,
            color: "#173D35",
          }}
        >
          Something went wrong
        </h1>
        <p
          style={{
            margin: "1rem 0 0",
            maxWidth: "28rem",
            lineHeight: 1.6,
            color: "#5C665F",
          }}
        >
          A critical error interrupted the page. Local browser data is usually
          unaffected. Try again to continue.
        </p>
        <button
          type="button"
          onClick={() => reset()}
          style={{
            marginTop: "1.75rem",
            cursor: "pointer",
            border: "none",
            borderRadius: "0.75rem",
            padding: "0.75rem 1.25rem",
            fontWeight: 600,
            background: "#C9A96E",
            color: "#173D35",
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
