"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main style={{ minHeight: "100svh", display: "grid", placeItems: "center", padding: 24, textAlign: "center" }}>
      <div>
        <h1 style={{ margin: "0 0 8px", fontSize: "clamp(1.6rem, 5vw, 2.2rem)", letterSpacing: "-.04em" }}>Something went wrong</h1>
        <p style={{ color: "#667085", maxWidth: 420, margin: "0 auto 22px", lineHeight: 1.7 }}>
          Please try again. If the problem continues, come back in a few minutes.
        </p>
        <button onClick={reset} style={{ padding: "12px 20px", borderRadius: 12, border: 0, background: "#3157d5", color: "#fff", fontWeight: 700, cursor: "pointer" }}>
          Try again
        </button>
      </div>
    </main>
  );
}
