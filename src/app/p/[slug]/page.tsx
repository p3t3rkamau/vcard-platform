import type { Metadata } from "next";
import Link from "next/link";
import { cache } from "react";
import { notFound, permanentRedirect } from "next/navigation";
import { headers } from "next/headers";
import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { countryFromHeaders, dialableNumber, isBotUserAgent, referrerDomainFromHeaders, safeExternalUrl, whatsappLink } from "@/lib/http";
import ContactIcon from "./ContactIcon";
import styles from "./profile.module.scss";

type PageProps = { params: Promise<{ slug: string }>; searchParams: Promise<{ source?: string; reported?: string }> };

export const dynamic = "force-dynamic";

// React cache(): generateMetadata and the page share one query per request.
const getCard = cache(async function getCard(slug: string) {
  return prisma.businessCard.findFirst({
    where: { slug, status: "PUBLISHED", deletedAt: null },
    include: {
      contactMethods: { where: { isVisible: true }, orderBy: { sortOrder: "asc" } },
      socialLinks: { where: { isVisible: true }, orderBy: { sortOrder: "asc" } },
      template: true,
    },
  });
});

function socialMark(platform: string) {
  const marks: Record<string, string> = {
    WhatsApp: "WA", Facebook: "f", Instagram: "◎", LinkedIn: "in", X: "𝕏",
    TikTok: "♪", YouTube: "▶", Telegram: "➤", Snapchat: "S", Pinterest: "P",
    GitHub: "⌘", Behance: "Bē", Dribbble: "◉", Threads: "@",
  };
  return marks[platform] || platform.slice(0, 1).toUpperCase();
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
    openGraph: { title: name, description, url: "/p/" + card.slug, images: card.profileImageUrl ? [card.profileImageUrl] : [], type: "profile" },
    twitter: { card: card.profileImageUrl ? "summary_large_image" : "summary", title: name, description },
  };
}

export default async function PublicCardPage({ params, searchParams }: PageProps) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const card = await getCard(slug);

  if (!card) {
    const oldSlug = await prisma.slugRedirect.findUnique({ where: { oldSlug: slug }, select: { newSlug: true } });
    // README promises a *permanent* redirect for retired slugs; keep ?source=qr so printed QR codes still count as scans.
    if (oldSlug) permanentRedirect("/p/" + oldSlug.newSlug + (query.source === "qr" ? "?source=qr" : ""));
    notFound();
  }

  const name = card.displayName || [card.firstName, card.lastName].filter(Boolean).join(" ") || "Your name";
  const website = safeExternalUrl(card.website);
  const profileImage = safeExternalUrl(card.profileImageUrl);
  const coverImage = safeExternalUrl(card.coverImageUrl);
  const companyLogo = safeExternalUrl(card.companyLogoUrl);
  const initials = name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  const templateClass = (card.template?.slug || "modern-corporate").replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
  const templateSlug = card.template?.slug || "modern-corporate";
  const requestHeaders = await headers();
  const userAgent = requestHeaders.get("user-agent");

  if (!isBotUserAgent(userAgent)) {
    const eventTypes = query.source === "qr" ? (["PROFILE_VIEW", "QR_SCAN"] as const) : (["PROFILE_VIEW"] as const);
    const countryCode = countryFromHeaders(requestHeaders);
    const referrerDomain = referrerDomainFromHeaders(requestHeaders);
    // after(): the analytics write no longer delays the page the visitor is waiting for.
    after(async () => {
      await prisma.analyticsEvent
        .createMany({ data: eventTypes.map((eventType) => ({ businessCardId: card.id, eventType, countryCode, referrerDomain })) })
        .catch(() => undefined);
    });
  }

  const cover = <div className={styles.cover} style={coverImage ? { backgroundImage: 'linear-gradient(120deg, rgba(18,31,70,.18), rgba(18,31,70,.48)), url("' + coverImage + '")' } : undefined} />;
  const identity = (
    <div className={styles.identity}>
      {profileImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className={styles.avatar} src={profileImage} alt={name} />
      ) : <div className={styles.avatarFallback}>{initials}</div>}
      {companyLogo && (
        // eslint-disable-next-line @next/next/no-img-element
        <img className={styles.companyLogo} src={companyLogo} alt={card.companyName ? card.companyName + " logo" : "Company logo"} />
      )}
      <h1>{name}</h1>
      {(card.jobTitle || card.companyName) && <p className={styles.role}>{[card.jobTitle, card.companyName].filter(Boolean).join(" · ")}</p>}
      {card.bio && <p className={styles.bio}>{card.bio}</p>}
    </div>
  );

  const actions = (
    <div className={styles.actions}>
      <a className={styles.saveButton} href={"/api/cards/" + card.slug + "/vcard"}><span aria-hidden="true">＋</span> Add to contacts</a>
      {website && <a className={styles.secondaryButton} href={"/api/cards/" + card.slug + "/links/website"} target="_blank" rel="noreferrer"><span aria-hidden="true">↗</span> Visit website</a>}
    </div>
  );

  const contactSection = (card.contactMethods.length > 0 || card.website || card.address) ? (
    <section className={styles.section}>
      <h2><span className={styles.sectionMark} aria-hidden="true">✦</span> Contact details</h2>
      <div className={styles.contactList}>
        {card.contactMethods.map((method) => {
          let link: React.ReactNode = <p>{method.value}</p>;
          if (method.type === "PHONE" && dialableNumber(method.value)) {
            link = <a href={"tel:" + dialableNumber(method.value)}>{method.value}</a>;
          } else if (method.type === "WHATSAPP") {
            const wa = whatsappLink(method.value);
            link = wa ? <a href={wa} target="_blank" rel="noreferrer">{method.value}</a> : <p>{method.value}</p>;
          } else if (method.type === "EMAIL") {
            link = <a href={"mailto:" + method.value}>{method.value}</a>;
          } else if (method.type === "WEBSITE" && safeExternalUrl(method.value)) {
            link = <a href={"/api/cards/" + card.slug + "/links/" + method.id} target="_blank" rel="noreferrer">{method.value}</a>;
          }
          return (
            <div className={styles.contactItem} key={method.id}>
              <span className={styles.contactIcon}><ContactIcon type={method.type} /></span>
              <div className={styles.contactText}>
                <span>{method.label || method.type.toLowerCase()}</span>
                {link}
              </div>
            </div>
          );
        })}
        {card.address && <div className={styles.contactItem}><span className={styles.contactIcon}><ContactIcon type="ADDRESS" /></span><div className={styles.contactText}><span>Address</span><p>{[card.address, card.city, card.region, card.country].filter(Boolean).join(", ")}</p></div></div>}
      </div>
    </section>
  ) : null;

  const socialSection = card.socialLinks.length > 0 ? (
    <section className={styles.section}>
      <h2><span className={styles.sectionMark} aria-hidden="true">◎</span> Find me online</h2>
      <div className={styles.socials}>
        {card.socialLinks.map((social) => {
          const url = safeExternalUrl(social.url);
          return url ? <a key={social.id} href={"/api/cards/" + card.slug + "/links/" + social.id} target="_blank" rel="noreferrer" aria-label={social.label || social.platform}><span className={styles.socialIcon} aria-hidden="true">{socialMark(social.platform)}</span><span>{social.label || social.platform}</span></a> : null;
        })}
      </div>
    </section>
  ) : null;

  const report = (
    <>
      {query.reported === "1" && <p className={styles.reportSuccess}>Thank you. Your report has been submitted for review.</p>}
      <details className={styles.reportDetails}>
        <summary>Report this profile</summary>
        <form action="/api/reports" method="post">
          <input type="hidden" name="cardId" value={card.id} />
          <input className={styles.reportTrap} type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" />
          <label>Reason<select name="reason" required><option value="SPAM">Spam</option><option value="IMPERSONATION">Impersonation</option><option value="ABUSIVE">Abusive or harmful content</option><option value="MISLEADING">Misleading information</option><option value="OTHER">Other</option></select></label>
          <label>Additional details<textarea name="details" maxLength={500} rows={3} placeholder="Optional details to help our review." /></label>
          <button type="submit">Submit report</button>
        </form>
      </details>
      <footer className={styles.footer}>Digital business card · <Link href="/">Create yours free</Link></footer>
    </>
  );

  const jsonLd = card.isSearchable ? {
    "@context": "https://schema.org",
    "@type": "Person",
    name,
    ...(card.jobTitle ? { jobTitle: card.jobTitle } : {}),
    ...(card.companyName ? { worksFor: { "@type": "Organization", name: card.companyName } } : {}),
    ...(profileImage ? { image: profileImage } : {}),
    ...(website ? { url: website } : {}),
  } : null;

  return (
    <main className={styles.page}>
      {jsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />}
      <article className={styles.profile + " " + (styles[templateClass as keyof typeof styles] || "")}>
        {templateSlug === "minimal-professional" ? (
          <><div className={styles.minimalHeader}><span className={styles.minimalRule} />{identity}</div>{actions}{contactSection}{socialSection}</>
        ) : templateSlug === "executive-dark" ? (
          <><div className={styles.executiveHeader}>{cover}<div className={styles.executiveIdentity}>{identity}</div></div>{actions}{contactSection}{socialSection}</>
        ) : templateSlug === "creative-portfolio" ? (
          <><div className={styles.creativeHeader}>{cover}<div className={styles.creativeIdentity}>{identity}</div><span className={styles.creativeOrb} /></div>{actions}{contactSection}{socialSection}</>
        ) : templateSlug === "elegant-business" ? (
          <><div className={styles.elegantHeader}><span className={styles.elegantOverline}>PERSONAL PROFILE</span>{identity}<span className={styles.elegantRule} /></div>{actions}{contactSection}{socialSection}</>
        ) : templateSlug === "gradient-modern" ? (
          <><div className={styles.gradientHeader}>{cover}{identity}</div>{actions}{contactSection}{socialSection}</>
        ) : templateSlug === "personal-branding" ? (
          <><div className={styles.personalHeader}>{cover}<div className={styles.personalIdentity}>{identity}</div></div>{actions}{contactSection}{socialSection}</>
        ) : templateSlug === "luxury-corporate" ? (
          <><div className={styles.luxuryHeader}><span className={styles.luxuryMonogram}>{initials}</span>{identity}<span className={styles.luxuryRule} /></div>{actions}{contactSection}{socialSection}</>
        ) : (
          <>{cover}{identity}{actions}{contactSection}{socialSection}</>
        )}
        {report}
      </article>
    </main>
  );
}
