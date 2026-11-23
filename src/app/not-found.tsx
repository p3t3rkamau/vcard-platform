import Link from "next/link";

export default function NotFound() {
  return (
    <main style={{ minHeight: "100svh", display: "grid", placeItems: "center", padding: 24, textAlign: "center" }}>
      <div>
        <p style={{ color: "#3157d5", fontWeight: 800, letterSpacing: ".1em", fontSize: 12 }}>404</p>
        <h1 style={{ margin: "8px 0", fontSize: "clamp(1.8rem, 5vw, 2.6rem)", letterSpacing: "-.04em" }}>We couldn’t find that page</h1>
        <p style={{ color: "#667085", maxWidth: 420, margin: "0 auto 22px", lineHeight: 1.7 }}>
          The card may have been unpublished, or the link may have been mistyped.
        </p>
        <Link href="/" style={{ display: "inline-block", padding: "12px 20px", borderRadius: 12, background: "#3157d5", color: "#fff", textDecoration: "none", fontWeight: 700 }}>
          Go to homepage
        </Link>
      </div>
    </main>
  );
}
