import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { createOrganization } from "./actions";
import styles from "../dashboard.module.scss";
import formStyles from "../cards/new/new-card.module.scss";
import orgStyles from "./organizations.module.scss";

export default async function OrganizationsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const organizations = await prisma.organization.findMany({
    where: { members: { some: { userId: session.user.id } } },
    include: {
      members: { include: { user: { select: { name: true, email: true } } } },
      cards: { where: { deletedAt: null }, select: { id: true, slug: true, displayName: true, status: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <main className={styles.shell}>
      <header className={styles.topbar}>
        <Link className={styles.brand} href="/dashboard">VCARD PLATFORM</Link>
        <Link className={formStyles.back} href="/dashboard">← Dashboard</Link>
      </header>
      <section className={styles.heading}>
        <div><h1>Organizations</h1><p>Manage your company workspace and employee cards.</p></div>
      </section>
      <section className={orgStyles.createPanel}>
        <h2>Create an organization</h2>
        <p>Set up a company workspace, then add people who already have a vCard Platform account.</p>
        <form action={createOrganization}>
          <input name="name" required minLength={2} maxLength={100} placeholder="Company or organization name" />
          <button type="submit">Create organization</button>
        </form>
      </section>
      <section className={orgStyles.list}>
        <h2>Your workspaces</h2>
        {organizations.length === 0 ? <p className={orgStyles.empty}>You have not joined an organization yet.</p> : organizations.map((organization) => (
          <Link href={"/dashboard/organizations/" + organization.id} className={orgStyles.orgCard} key={organization.id}>
            <div><h3>{organization.name}</h3><p>/{organization.slug}</p></div>
            <div className={orgStyles.counts}><span>{organization.members.length} members</span><span>{organization.cards.length} cards</span></div>
          </Link>
        ))}
      </section>
    </main>
  );
}
