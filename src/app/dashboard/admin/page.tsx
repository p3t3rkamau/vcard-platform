import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { isAdminEmail } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { moderateCard, updateReportStatus } from "./actions";
import styles from "../dashboard.module.scss";
import adminStyles from "./admin.module.scss";

export default async function AdminPage() {
  const session = await auth();
  if (!session?.user?.id || !isAdminEmail(session.user.email)) redirect("/dashboard");

  const [users, cards, reports, organizations] = await Promise.all([
    prisma.user.findMany({ orderBy: { createdAt: "desc" }, take: 50, select: { id: true, name: true, email: true, createdAt: true } }),
    prisma.businessCard.findMany({ orderBy: { updatedAt: "desc" }, take: 50, include: { owner: { select: { name: true, email: true } } } }),
    prisma.profileReport.findMany({ where: { status: "OPEN" }, orderBy: { createdAt: "desc" }, take: 50, include: { businessCard: { select: { id: true, slug: true, displayName: true, status: true } }, reporter: { select: { email: true } } } }),
    prisma.organization.count(),
  ]);

  return (
    <main className={styles.shell}>
      <header className={styles.topbar}><Link className={styles.brand} href="/dashboard">VCARD PLATFORM</Link><Link className={adminStyles.back} href="/dashboard">← Dashboard</Link></header>
      <section className={styles.heading}><div><h1>Platform administration</h1><p>Review accounts, published cards and community reports.</p></div></section>
      <div className={adminStyles.stats}>
        <article><span>Users</span><strong>{users.length}</strong></article>
        <article><span>Cards in latest 50</span><strong>{cards.length}</strong></article>
        <article><span>Open reports</span><strong>{reports.length}</strong></article>
        <article><span>Organizations</span><strong>{organizations}</strong></article>
      </div>

      <section className={adminStyles.section}>
        <h2>Open profile reports</h2>
        {reports.length === 0 ? <p className={adminStyles.empty}>No open reports.</p> : reports.map((report) => (
          <article className={adminStyles.item} key={report.id}>
            <div><strong>{report.businessCard.displayName || report.businessCard.slug}</strong><span>{report.reason.toLowerCase()} · reported by {report.reporter?.email || "guest"} · {report.createdAt.toLocaleDateString()}</span>{report.details && <p>{report.details}</p>}</div>
            <div className={adminStyles.actions}>
              <Link href={"/p/" + report.businessCard.slug} target="_blank">Open profile</Link>
              <form action={updateReportStatus}><input type="hidden" name="reportId" value={report.id} /><select name="status" defaultValue="REVIEWED"><option value="REVIEWED">Mark reviewed</option><option value="DISMISSED">Dismiss</option><option value="ACTIONED">Actioned</option></select><button type="submit">Update report</button></form>
              <form action={moderateCard}><input type="hidden" name="cardId" value={report.businessCard.id} /><input type="hidden" name="action" value="UNPUBLISH" /><button type="submit">Unpublish card</button></form>
            </div>
          </article>
        ))}
      </section>

      <section className={adminStyles.section}>
        <h2>Recent cards</h2>
        {cards.map((card) => (
          <article className={adminStyles.item} key={card.id}>
            <div><strong>{card.displayName || "Untitled card"}</strong><span>{card.slug} · {card.status.toLowerCase()} · {card.owner.email || card.owner.name || "Unknown owner"}</span></div>
            <div className={adminStyles.actions}>
              {card.status === "PUBLISHED" && <Link href={"/p/" + card.slug} target="_blank">View</Link>}
              <form action={moderateCard}><input type="hidden" name="cardId" value={card.id} /><select name="action" defaultValue="UNPUBLISH"><option value="UNPUBLISH">Unpublish</option><option value="HIDE_FROM_SEARCH">Hide from search</option><option value="SOFT_DELETE">Soft delete</option><option value="RESTORE">Restore as draft</option></select><button type="submit">Apply</button></form>
            </div>
          </article>
        ))}
      </section>

      <section className={adminStyles.section}>
        <h2>Recent users</h2>
        <div className={adminStyles.users}>{users.map((user) => <div key={user.id}><strong>{user.name || "Unnamed user"}</strong><span>{user.email || "No email"} · {user.createdAt.toLocaleDateString()}</span></div>)}</div>
      </section>
    </main>
  );
}
