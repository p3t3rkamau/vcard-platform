import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { updateBusinessCardDetails } from "../../../actions";
import styles from "../../../dashboard.module.scss";
import formStyles from "../../new/new-card.module.scss";

type EditCardPageProps = {
  params: Promise<{ cardId: string }>;
  searchParams: Promise<{ created?: string; duplicated?: string }>;
};

export default async function EditCardPage({ params, searchParams }: EditCardPageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const [{ cardId }, query] = await Promise.all([params, searchParams]);
  const card = await prisma.businessCard.findFirst({
    where: { id: cardId, ownerId: session.user.id, deletedAt: null },
    select: {
      id: true,
      slug: true,
      displayName: true,
      jobTitle: true,
      companyName: true,
      bio: true,
      status: true,
    },
  });

  if (!card) notFound();

  return (
    <main className={styles.shell}>
      <Link className={styles.brand} href="/dashboard">VCARD PLATFORM</Link>
      <section className={formStyles.panel}>
        <Link href="/dashboard" className={formStyles.back}>← Back to dashboard</Link>
        <span className={formStyles.eyebrow}>CARD DETAILS</span>
        <h1>{card.displayName || "Your digital card"}</h1>
        <p className={formStyles.intro}>
          This is the first part of your card builder. Your profile URL is permanent:
          <strong> /p/{card.slug}</strong>
        </p>

        {query.created === "1" && <p className={formStyles.success}>Your digital card has been created.</p>}
        {query.duplicated === "1" && <p className={formStyles.success}>A draft copy has been created.</p>}

        <form action={updateBusinessCardDetails} className={formStyles.form}>
          <input type="hidden" name="cardId" value={card.id} />
          <label>
            Display name <span>*</span>
            <input name="displayName" required minLength={2} maxLength={80} defaultValue={card.displayName ?? ""} />
          </label>
          <label>
            Job title
            <input name="jobTitle" maxLength={100} defaultValue={card.jobTitle ?? ""} />
          </label>
          <label>
            Company or organization
            <input name="companyName" maxLength={120} defaultValue={card.companyName ?? ""} />
          </label>
          <label>
            Short bio
            <textarea name="bio" maxLength={500} rows={4} defaultValue={card.bio ?? ""} placeholder="A short introduction about what you do." />
          </label>
          <p className={formStyles.helper}>Current status: {card.status.toLowerCase()}. More builder sections for profile photos, contacts, social links and templates are coming next.</p>
          <button type="submit">Save details <span aria-hidden="true">→</span></button>
        </form>
      </section>
    </main>
  );
}
