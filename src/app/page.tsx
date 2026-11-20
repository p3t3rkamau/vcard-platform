import styles from "./page.module.scss";

export default function HomePage() {
  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <span className={styles.eyebrow}>DIGITAL IDENTITY, SIMPLIFIED</span>
        <h1>Your business card.<br />Always in reach.</h1>
        <p>
          Create a professional digital business card, share it with a QR code,
          and let people save your details in one tap.
        </p>
        <div className={styles.status}>
          <span className={styles.statusDot} aria-hidden="true" />
          Foundation is being set up
        </div>
      </div>
      <footer className={styles.footer}>A free digital vCard platform</footer>
    </main>
  );
}
