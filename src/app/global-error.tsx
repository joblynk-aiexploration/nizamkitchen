"use client";

export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#eef6f5", color: "#132235", fontFamily: "Arial, sans-serif" }}>
        <main
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px",
          }}
        >
          <section
            style={{
              maxWidth: "480px",
              border: "1px solid #cbdde0",
              borderRadius: "24px",
              background: "#ffffff",
              boxShadow: "0 24px 70px rgba(15, 67, 68, 0.16)",
              padding: "32px",
              textAlign: "center",
            }}
          >
            <p style={{ margin: 0, color: "#0f766e", fontSize: "12px", fontWeight: 700, letterSpacing: "0.18em" }}>
              NIZAMKITCHEN
            </p>
            <h1 style={{ margin: "16px 0 0", fontSize: "32px", lineHeight: 1.1 }}>Something went wrong</h1>
            <p style={{ margin: "16px 0 0", color: "#596b7a", lineHeight: 1.6 }}>
              An unexpected error occurred. Please try again, or return to your dashboard.
            </p>
            {error.digest ? (
              <p style={{ margin: "12px 0 0", color: "#7c8a99", fontFamily: "monospace", fontSize: "12px" }}>
                Ref: {error.digest}
              </p>
            ) : null}
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "12px", marginTop: "28px" }}>
              <button
                type="button"
                onClick={() => unstable_retry()}
                style={{
                  border: 0,
                  borderRadius: "16px",
                  background: "#0f766e",
                  color: "#ffffff",
                  cursor: "pointer",
                  fontWeight: 700,
                  padding: "12px 18px",
                }}
              >
                Try again
              </button>
              <a
                href="/dashboard"
                style={{
                  border: "1px solid #cbdde0",
                  borderRadius: "16px",
                  color: "#132235",
                  fontWeight: 700,
                  padding: "12px 18px",
                  textDecoration: "none",
                }}
              >
                Go to dashboard
              </a>
            </div>
          </section>
        </main>
      </body>
    </html>
  );
}
