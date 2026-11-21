import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import styles from "../dashboard.module.scss";
import analyticsStyles from "./analytics.module.scss";

export default async function AnalyticsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const cards = await prisma.businessCard.findMany({
    where: { ownerId: session.user.id, deletedAt: null },
    select: { id: true, slug: true, displayName: true, status: true },
    orderBy: { updatedAt: "desc" },
  });
  const [timeWindow] = await prisma.$queryRaw<Array<{ since: Date }>>`SELECT NOW() - INTERVAL '30 days' AS since`;
  const since = timeWindow.since;
  const metrics = await Promise.all(cards.map(async (card) => {
    const [views, scans, saves, websiteClicks, socialClicks] = await Promise.all([
      prisma.analyticsEvent.count({ where: { businessCardId: card.id, eventType: "PROFILE_VIEW", createdAt: { gte: since } } }),
      prisma.analyticsEvent.count({ where: { businessCardId: card.id, eventType: "QR_SCAN", createdAt: { gte: since } } }),
      prisma.analyticsEvent.count({ where: { businessCardId: card.id, eventType: "CONTACT_SAVE", createdAt: { gte: since } } }),
      prisma.analyticsEvent.count({ where: { businessCardId: card.id, eventType: "WEBSITE_CLICK", createdAt: { gte: since } } }),
      prisma.analyticsEvent.count({ where: { businessCardId: card.id, eventType: "SOCIAL_CLICK", createdAt: { gte: since } } }),
    ]);
    return { ...card, views, scans, saves, websiteClicks, socialClicks };
  }));

  const totals = metrics.reduce((acc, card) => ({
    views: acc.views + card.views, scans: acc.scans + card.scans, saves: acc.saves + card.saves,
    clicks: acc.clicks + card.websiteClicks + card.socialClicks,
  }), { views: 0, scans: 0, saves: 0, clicks: 0 });

  return (
    <main className={styles.shell}>
      <header className={styles.topbar}><Link className={styles.brand} href="/dashboard">VCARD PLATFORM</Link><Link href="/dashboard" className={analyticsStyles.back}>← Dashboard</Link></header>
      <section className={styles.heading}><div><h1>Analytics</h1><p>Performance across your published digital cards · last 30 days.</p></div></section>
      <div className={analyticsStyles.stats}>
        <article><span>Profile views</span><strong>{totals.views.toLocaleString()}</strong></article>
        <article><span>QR scans</span><strong>{totals.scans.toLocaleString()}</strong></article>
        <article><span>Contact saves</span><strong>{totals.saves.toLocaleString()}</strong></article>
        <article><span>Link clicks</span><strong>{totals.clicks.toLocaleString()}</strong></article>
      </div>
      <section className={analyticsStyles.tableSection}>
        <h2>Card performance</h2>
        {metrics.length === 0 ? <p>Create a card to start collecting analytics.</p> : (
          <div className={analyticsStyles.tableWrap}>
            <table className={analyticsStyles.table}>
              <thead><tr><th>Card</th><th>Views</th><th>QR scans</th><th>Contact saves</th><th>Website</th><th>Social</th></tr></thead>
              <tbody>{metrics.map((card) => <tr key={card.id}><td><Link href={"/p/" + card.slug} target="_blank">{card.displayName || "Untitled card"}</Link><small>{card.status.toLowerCase()}</small></td><td>{card.views}</td><td>{card.scans}</td><td>{card.saves}</td><td>{card.websiteClicks}</td><td>{card.socialClicks}</td></tr>)}</tbody>
            </table>
          </div>
        )}
      </section>
      <p className={analyticsStyles.privacy}>Analytics are aggregated event counts. We do not store visitor IP addresses or personal browsing profiles.</p>
    </main>
  );
}
