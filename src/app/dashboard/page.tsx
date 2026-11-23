import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isAdminEmail } from "@/lib/admin";
import {
  archiveBusinessCard,
  deleteBusinessCard,
  duplicateBusinessCard,
  publishBusinessCard,
  restoreBusinessCard,
  unpublishBusinessCard,
} from "./actions";
import styles from "./dashboard.module.scss";

type DashboardPageProps = {
  searchParams: Promise<{ updated?: string; error?: string }>;
};

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const [cards, query] = await Promise.all([
    prisma.businessCard.findMany({
      where: { ownerId: session.user.id, deletedAt: null },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        slug: true,
        displayName: true,
        jobTitle: true,
        companyName: true,
        status: true,
        updatedAt: true,
      },
    }),
    searchParams,
  ]);

  const activeCards = cards.filter((card) => card.status !== "ARCHIVED");
  const publishedCards = cards.filter((card) => card.status === "PUBLISHED");
  const draftCards = cards.filter((card) => card.status === "DRAFT");
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");

  return (
    <main className={styles.shell}>
      <header className={styles.topbar}>
        <Link className={styles.brand} href="/dashboard">VCARD PLATFORM</Link>
        <div className={styles.userActions}>
          <span>{session.user.name || session.user.email}</span>
          <form className={styles.signOut} action={async () => {
            "use server";
            await signOut({ redirectTo: "/login" });
          }}>
            <button type="submit">Sign out</button>
          </form>
        </div>
      </header>

      <section className={styles.heading}>
        <div>
          <h1>Your cards</h1>
          <p>Create and manage your digital identity from one place.</p>
        </div>
        <div className={styles.dashboardActions}><Link className={styles.actionLink} href="/dashboard/organizations">Organizations</Link><Link className={styles.actionLink} href="/dashboard/analytics">Analytics</Link>{isAdminEmail(session.user.email) && <Link className={styles.actionLink} href="/dashboard/admin">Admin</Link>}<Link className={styles.primaryButton} href="/dashboard/cards/new">＋ Create a card</Link></div>
      </section>

      {query.updated === "1" && <p className={styles.notice}>Your card details have been saved.</p>}
      {query.error === "invalid" && <p className={styles.notice}>Please check the details and try again.</p>}
      {query.error === "limit" && <p className={styles.notice}>You have reached the card limit or are creating cards too quickly. Archive or delete a card, or try again later.</p>}
      {query.error === "not-found" && <p className={styles.notice}>That card could not be found.</p>}
      {query.error === "publish" && <p className={styles.notice}>Add a display name before publishing your card.</p>}

      <section className={styles.stats} aria-label="Card statistics">
        <div className={styles.stat}><span>All active cards</span><strong>{activeCards.length}</strong></div>
        <div className={styles.stat}><span>Published</span><strong>{publishedCards.length}</strong></div>
        <div className={styles.stat}><span>Drafts</span><strong>{draftCards.length}</strong></div>
      </section>

      <section>
        <div className={styles.sectionHeading}>
          <h2>Your digital business cards</h2>
          <span>{cards.length} {cards.length === 1 ? "card" : "cards"}</span>
        </div>

        {cards.length === 0 ? (
          <div className={styles.empty}>
            <h3>Your first digital card starts here.</h3>
            <p>Add your name and professional details, then build out your contacts, social links, design and QR code.</p>
            <Link className={styles.primaryButton} href="/dashboard/cards/new">Create your first card</Link>
          </div>
        ) : (
          <div className={styles.cardGrid}>
            {cards.map((card) => (
              <article className={styles.card} key={card.id}>
                <div className={styles.cardHeader}>
                  <div className={styles.cardIdentity}>
                    <div className={styles.avatar} aria-hidden="true">
                      {(card.displayName || "V").trim().charAt(0).toUpperCase()}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <h3 className={styles.cardName}>{card.displayName || "Untitled card"}</h3>
                      <p className={styles.cardMeta}>{[card.jobTitle, card.companyName].filter(Boolean).join(" · ") || "Add your role and company"}</p>
                    </div>
                  </div>
                  <span className={card.status === "PUBLISHED" ? `${styles.status} ${styles.statusPublished}` : styles.status}>
                    {card.status.toLowerCase()}
                  </span>
                </div>

                <p className={styles.cardUrl}>{appUrl}/p/{card.slug}</p>

                <div className={styles.cardFooter}>
                  <Link className={styles.actionLink} href={`/dashboard/cards/${card.id}/edit`}>Edit details</Link>
                  {card.status === "PUBLISHED" ? (
                    <>
                      <Link className={styles.actionLink} href={`/p/${card.slug}`} target="_blank">View profile</Link>
                      <form action={unpublishBusinessCard}>
                        <input type="hidden" name="cardId" value={card.id} />
                        <button className={styles.actionButton} type="submit">Unpublish</button>
                      </form>
                    </>
                  ) : card.status !== "ARCHIVED" ? (
                    <form action={publishBusinessCard}>
                      <input type="hidden" name="cardId" value={card.id} />
                      <button className={styles.actionButton} type="submit">Publish</button>
                    </form>
                  ) : null}
                  <form action={duplicateBusinessCard}>
                    <input type="hidden" name="cardId" value={card.id} />
                    <button className={styles.actionButton} type="submit">Duplicate</button>
                  </form>
                  {card.status === "ARCHIVED" ? (
                    <form action={restoreBusinessCard}>
                      <input type="hidden" name="cardId" value={card.id} />
                      <button className={styles.actionButton} type="submit">Restore</button>
                    </form>
                  ) : (
                    <form action={archiveBusinessCard}>
                      <input type="hidden" name="cardId" value={card.id} />
                      <button className={styles.actionButton} type="submit">Archive</button>
                    </form>
                  )}
                  <form action={deleteBusinessCard}>
                    <input type="hidden" name="cardId" value={card.id} />
                    <button className={`${styles.actionButton} ${styles.danger}`} type="submit">Delete</button>
                  </form>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
