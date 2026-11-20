import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { createBusinessCard } from "../../actions";
import styles from "../../dashboard.module.scss";
import formStyles from "./new-card.module.scss";

export default async function NewCardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  return (
    <main className={styles.shell}>
      <Link className={styles.brand} href="/dashboard">VCARD PLATFORM</Link>
      <section className={formStyles.panel}>
        <Link href="/dashboard" className={formStyles.back}>← Back to dashboard</Link>
        <span className={formStyles.eyebrow}>NEW DIGITAL CARD</span>
        <h1>Let’s create your card.</h1>
        <p className={formStyles.intro}>
          Start with the details people should see when they open your digital business card.
          You can add contact methods, social links and branding in the card builder.
        </p>

        <form action={createBusinessCard} className={formStyles.form}>
          <label>
            Display name <span>*</span>
            <input name="displayName" required minLength={2} maxLength={80} placeholder="e.g. Peter Kamau" autoComplete="name" />
          </label>
          <label>
            Job title
            <input name="jobTitle" maxLength={100} placeholder="e.g. Creative Director" autoComplete="organization-title" />
          </label>
          <label>
            Company or organization
            <input name="companyName" maxLength={120} placeholder="e.g. Bureau Graphics" autoComplete="organization" />
          </label>
          <p className={formStyles.helper}>Your public profile address will be created automatically. It will remain stable when you update your card details.</p>
          <button type="submit">Create digital card <span aria-hidden="true">→</span></button>
        </form>
      </section>
    </main>
  );
}
