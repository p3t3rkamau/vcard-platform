import type { Metadata } from "next";
import Link from "next/link";
import styles from "./page.module.scss";

export const metadata: Metadata = {
  title: { absolute: "vCard Platform — Free digital business cards with QR codes" },
  description: "Create a free digital business card, share it with a custom QR code, and let people save your details to their phone in one tap.",
  alternates: { canonical: "/" },
};

const features = [
  { title: "Share with a QR code", text: "Design a QR code with your colors, logo and frame. Print it on a card, a banner or a shirt. Scanners need no app." },
  { title: "Saved in one tap", text: "Visitors add you to their contacts straight from your page, with your name, number, email, company and photo." },
  { title: "Designs that fit you", text: "Pick from eight templates, from clean and minimal to bold and creative. Switch any time without losing your details." },
  { title: "Know it’s working", text: "See profile views, QR scans, contact saves and link clicks, so you know which cards actually get used." },
];

export default function HomePage() {
  return (
    <main className={styles.page}>
      <header className={styles.nav}>
        <Link className={styles.brand} href="/">VCARD PLATFORM</Link>
        <nav aria-label="Main">
          <Link href="/pricing">Pricing</Link>
          <Link href="/login">Sign in</Link>
        </nav>
      </header>

      <section className={styles.hero}>
        <div className={styles.copy}>
          <span className={styles.eyebrow}>DIGITAL BUSINESS CARDS · FREE</span>
          <h1>Your business card.<br />Always in reach.</h1>
          <p>
            Create a professional digital card in minutes, share it with a QR code, and let people
            save your details in one tap. No app to install, nothing to print twice.
          </p>
          <div className={styles.actions}>
            <Link className={styles.primary} href="/register">Create your free card</Link>
            <Link className={styles.secondary} href="/login">Sign in</Link>
          </div>
        </div>

        <div className={styles.preview} aria-hidden="true">
          <div className={styles.phone}>
            <div className={styles.phoneCover} />
            <div className={styles.phoneAvatar}>AM</div>
            <strong>Amina Mwangi</strong>
            <span>Creative Director · Studio Nine</span>
            <div className={styles.phoneButton}>＋ Add to contacts</div>
            <div className={styles.phoneRow}><i />+254 700 000 000</div>
            <div className={styles.phoneRow}><i />amina@studionine.example</div>
          </div>
        </div>
      </section>

      <section className={styles.features} aria-labelledby="features-heading">
        <h2 id="features-heading">Everything you need to be remembered</h2>
        <div className={styles.grid}>
          {features.map((feature) => (
            <article key={feature.title}>
              <h3>{feature.title}</h3>
              <p>{feature.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.closing}>
        <h2>Ready when you are</h2>
        <p>Your card gets a permanent link, so what you share today keeps working tomorrow.</p>
        <Link className={styles.primary} href="/register">Create your free card</Link>
      </section>

      <footer className={styles.footer}>A free digital vCard platform</footer>
    </main>
  );
}
