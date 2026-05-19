"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html>
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif" }}>
        <div
          style={{
            display: "flex",
            minHeight: "100vh",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background: "linear-gradient(145deg,#f7f9fb 0%,#ebf5f5 100%)",
            padding: "1.25rem",
            textAlign: "center",
          }}
        >
          <p style={{ fontSize: "5rem", fontWeight: "bold", color: "#f87171", opacity: 0.2 }}>500</p>
          <h1 style={{ fontSize: "1.875rem", fontWeight: "600", marginTop: "0.5rem" }}>
            Critical error
          </h1>
          <p style={{ color: "#64748b", marginTop: "1rem", maxWidth: "28rem" }}>
            A critical application error occurred. Please reload or contact support if the issue persists.
          </p>
          {error.digest && (
            <p style={{ fontFamily: "monospace", fontSize: "0.75rem", color: "#94a3b8", marginTop: "0.5rem" }}>
              Ref: {error.digest}
            </p>
          )}
          <div style={{ display: "flex", gap: "0.75rem", marginTop: "2rem", flexWrap: "wrap", justifyContent: "center" }}>
            <button
              onClick={reset}
              style={{
                borderRadius: "1rem",
                background: "#0e7490",
                padding: "0.75rem 1.5rem",
                fontSize: "0.875rem",
                fontWeight: "600",
                color: "white",
                border: "none",
                cursor: "pointer",
              }}
            >
              Try again
            </button>
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a
              href="/"
              style={{
                borderRadius: "1rem",
                border: "1px solid #e2e8f0",
                padding: "0.75rem 1.5rem",
                fontSize: "0.875rem",
                fontWeight: "600",
                color: "#0f172a",
                textDecoration: "none",
              }}
            >
              Back to home
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
