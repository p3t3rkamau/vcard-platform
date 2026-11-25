import type { Metadata } from "next";
import Link from "next/link";
import PricingPlans from "./PricingPlans";
import { SHOW_PREVIEW_NOTICE } from "./plans";
import styles from "./pricing.module.scss";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Simple digital business card pricing in Kenyan shillings, for individuals and organisations. Start free.",
  alternates: { canonical: "/pricing" },
};

export default function PricingPage() {
  return (
    <main className={styles.page}>
      <header className={styles.nav}>
        <Link className={styles.brand} href="/">VCARD PLATFORM</Link>
        <nav aria-label="Main">
          <Link href="/pricing" aria-current="page">Pricing</Link>
          <Link href="/login">Sign in</Link>
        </nav>
      </header>

      <section className={styles.hero}>
        <span className={styles.eyebrow}>PRICING · KENYAN SHILLINGS</span>
        <h1>Simple pricing that grows with you</h1>
        <p>Start free. Upgrade when you need more cards, a branded QR code, or a whole team on the same page.</p>
      </section>

      {SHOW_PREVIEW_NOTICE && (
        <p className={styles.notice} role="note">
          <strong>Preview pricing.</strong> Prices and plan limits are placeholders while billing is being set up.
        </p>
      )}

      <PricingPlans />

      <footer className={styles.footer}>
        <p>All prices are in Kenyan shillings (KSh). Annual plans are billed once a year.</p>
        <Link href="/">← Back to home</Link>
      </footer>
    </main>
  );
}
