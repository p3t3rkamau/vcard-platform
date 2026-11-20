import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import styles from "./profile.module.scss";

type PageProps = { params: Promise<{ slug: string }> };

async function getCard(slug: string) {
  return prisma.businessCard.findFirst({
    where: { slug, status: "PUBLISHED", deletedAt: null },
    include: {
      contactMethods: { where: { isVisible: true }, orderBy: { sortOrder: "asc" } },
      socialLinks: { where: { isVisible: true }, orderBy: { sortOrder: "asc" } },
    },
  });
}

function safeExternalUrl(value: string | null | undefined) {
  if (!value) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(value) ? value : "https://" + value);
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const card = await getCard(slug);
  if (!card) return { title: "Profile not found" };

  const name = card.displayName || [card.firstName, card.lastName].filter(Boolean).join(" ") || "Digital business card";
  const description = card.bio || [card.jobTitle, card.companyName].filter(Boolean).join(" at ") || "Connect with " + name + ".";

  return {
    title: name,
    description,
    alternates: { canonical: "/p/" + card.slug },
    robots: { index: card.isSearchable, follow: true },
    openGraph: {
      title: name,
      description,
      images: card.profileImageUrl ? [card.profileImageUrl] : [],
      type: "profile",
    },
  };
}

export default async function PublicCardPage({ params }: PageProps) {
  const { slug } = await params;
  const card = await getCard(slug);

  if (!card) {
    const oldSlug = await prisma.slugRedirect.findUnique({
      where: { oldSlug: slug },
      select: { newSlug: true },
    });
    if (oldSlug) redirect("/p/" + oldSlug.newSlug);
    notFound();
  }

  const name = card.displayName || [card.firstName, card.lastName].filter(Boolean).join(" ") || "Digital business card";
  const website = safeExternalUrl(card.website);
  const initials = name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();

  return (
    <main className={styles.page}>
      <article className={styles.profile}>
        <div className={styles.cover} style={card.coverImageUrl ? { backgroundImage: 'linear-gradient(120deg, rgba(18,31,70,.2), rgba(18,31,70,.65)), url("' + card.coverImageUrl + '")' } : undefined} />
        <div className={styles.identity}>
          {card.profileImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className={styles.avatar} src={card.profileImageUrl} alt={name} />
          ) : <div className={styles.avatarFallback}>{initials}</div>}
          <h1>{name}</h1>
          {(card.jobTitle || card.companyName) && (
            <p className={styles.role}>{[card.jobTitle, card.companyName].filter(Boolean).join(" · ")}</p>
          )}
          {card.bio && <p className={styles.bio}>{card.bio}</p>}
        </div>

        <div className={styles.actions}>
          <a className={styles.saveButton} href={"/api/cards/" + card.slug + "/vcard"}>＋ Add to contacts</a>
          {website && <a className={styles.secondaryButton} href={website} target="_blank" rel="noreferrer">Visit website</a>}
        </div>

        {(card.contactMethods.length > 0 || card.website || card.address) && (
          <section className={styles.section}>
            <h2>Contact</h2>
            <div className={styles.contactList}>
              {card.contactMethods.map((method) => {
                const href = method.type === "PHONE" || method.type === "WHATSAPP"
                  ? "tel:" + method.value
                  : method.type === "EMAIL" ? "mailto:" + method.value
                  : method.type === "WEBSITE" ? safeExternalUrl(method.value) : null;
                return (
                  <div className={styles.contactItem} key={method.id}>
                    <span>{method.label || method.type.toLowerCase()}</span>
                    {href && href.startsWith("http") ? (
                      <a href={href} target="_blank" rel="noreferrer">{method.value}</a>
                    ) : href ? <a href={href}>{method.value}</a> : <p>{method.value}</p>}
                  </div>
                );
              })}
              {card.address && <div className={styles.contactItem}><span>Address</span><p>{[card.address, card.city, card.region, card.country].filter(Boolean).join(", ")}</p></div>}
            </div>
          </section>
        )}

        {card.socialLinks.length > 0 && (
          <section className={styles.section}>
            <h2>Find me online</h2>
            <div className={styles.socials}>
              {card.socialLinks.map((social) => {
                const url = safeExternalUrl(social.url);
                return url ? <a key={social.id} href={url} target="_blank" rel="noreferrer">{social.label || social.platform}</a> : null;
              })}
            </div>
          </section>
        )}
        <footer className={styles.footer}>Digital business card · <Link href="/">Create yours free</Link></footer>
      </article>
    </main>
  );
}
