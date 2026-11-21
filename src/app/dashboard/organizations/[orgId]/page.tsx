import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { addOrganizationMember, removeOrganizationMember, updateOrganizationMemberRole } from "../actions";
import styles from "../../dashboard.module.scss";
import orgStyles from "../organizations.module.scss";

type Props = { params: Promise<{ orgId: string }>; searchParams: Promise<{ created?: string; member?: string; error?: string }> };

export default async function OrganizationDetailPage({ params, searchParams }: Props) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const [{ orgId }, query] = await Promise.all([params, searchParams]);

  const organization = await prisma.organization.findFirst({
    where: { id: orgId, members: { some: { userId: session.user.id } } },
    include: {
      members: {
        include: {
          user: {
            select: {
              id: true, name: true, email: true,
              ownedCards: { where: { organizationId: orgId, deletedAt: null }, select: { id: true, slug: true, displayName: true, status: true } },
            },
          },
        },
        orderBy: { joinedAt: "asc" },
      },
    },
  });
  if (!organization) notFound();

  const currentMembership = organization.members.find((member) => member.userId === session.user.id);
  const canManage = currentMembership && ["OWNER", "ADMIN"].includes(currentMembership.role);
  const isOwner = currentMembership?.role === "OWNER";

  return (
    <main className={styles.shell}>
      <header className={styles.topbar}>
        <Link className={styles.brand} href="/dashboard">VCARD PLATFORM</Link>
        <Link href="/dashboard/organizations" className={orgStyles.back}>← Organizations</Link>
      </header>
      <section className={styles.heading}>
        <div><h1>{organization.name}</h1><p>Employee directory and company cards.</p></div>
      </section>
      {query.created === "1" && <p className={styles.notice}>Organization created successfully.</p>}
      {query.member === "added" && <p className={styles.notice}>Member added to the organization.</p>}
      {query.error === "user-not-found" && <p className={orgStyles.error}>No account exists with that email yet. Ask them to register first.</p>}
      {query.error === "already-member" && <p className={orgStyles.error}>You are already a member of this organization.</p>}

      {canManage && (
        <section className={orgStyles.createPanel}>
          <h2>Add an employee</h2>
          <p>Enter the email address used by their existing vCard Platform account. Email invitations will be added once email delivery is configured.</p>
          <form action={addOrganizationMember}>
            <input type="hidden" name="organizationId" value={organization.id} />
            <input type="email" name="email" required placeholder="employee@example.com" />
            <select name="role" defaultValue="EDITOR">
              {isOwner && <option value="ADMIN">Admin</option>}
              <option value="EDITOR">Editor</option><option value="VIEWER">Viewer</option>
            </select>
            <button type="submit">Add employee</button>
          </form>
        </section>
      )}

      <section className={orgStyles.list}>
        <h2>Employees ({organization.members.length})</h2>
        {organization.members.map((member) => (
          <article className={orgStyles.memberCard} key={member.id}>
            <div className={orgStyles.memberHead}>
              <div><h3>{member.user.name || "Unnamed user"}</h3><p>{member.user.email || "No email"}</p></div>
              <span>{member.role.toLowerCase()}</span>
            </div>
            <div className={orgStyles.employeeCards}>
              {member.user.ownedCards.length ? member.user.ownedCards.map((card) => (
                <Link href={"/p/" + card.slug} key={card.id} target="_blank">
                  <strong>{card.displayName || "Untitled card"}</strong><small>{card.status.toLowerCase()}</small>
                </Link>
              )) : <p>No cards linked to this organization yet.</p>}
            </div>
            {isOwner && member.role !== "OWNER" && (
              <div className={orgStyles.memberActions}>
                <form action={updateOrganizationMemberRole}>
                  <input type="hidden" name="organizationId" value={organization.id} />
                  <input type="hidden" name="memberId" value={member.id} />
                  <select name="role" defaultValue={member.role}>
                    <option value="ADMIN">Admin</option><option value="EDITOR">Editor</option><option value="VIEWER">Viewer</option>
                  </select>
                  <button type="submit">Update role</button>
                </form>
                <form action={removeOrganizationMember}>
                  <input type="hidden" name="organizationId" value={organization.id} />
                  <input type="hidden" name="memberId" value={member.id} />
                  <button type="submit">Remove</button>
                </form>
              </div>
            )}
            {!isOwner && canManage && ["EDITOR", "VIEWER"].includes(member.role) && member.user.id !== session.user.id && (
              <form action={removeOrganizationMember} className={orgStyles.memberActions}>
                <input type="hidden" name="organizationId" value={organization.id} />
                <input type="hidden" name="memberId" value={member.id} />
                <button type="submit">Remove viewer</button>
              </form>
            )}
          </article>
        ))}
      </section>
    </main>
  );
}
