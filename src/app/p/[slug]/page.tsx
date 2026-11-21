import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import styles from "./profile.module.scss";

type PageProps = { params: Promise<{ slug: string }>; searchParams: Promise<{ source?: string; reported?: string }> };

export const dynamic = "force-dynamic";

async function getCard(slug: string) {
  return prisma.businessCard.findFirst({
    where: { slug, status: "PUBLISHED", deletedAt: null },
    include: {
      contactMethods: { where: { isVisible: true }, orderBy: { sortOrder: "asc" } },
      socialLinks: { where: { isVisible: true }, orderBy: { sortOrder: "asc" } },
      template: true,
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

function contactSymbol(type: string) {
  const symbols: Record<string, string> = {
    PHONE: "☎",
    EMAIL: "✉",
    WHATSAPP: "◉",
    WEBSITE: "↗",
    ADDRESS: "⌖",
    OTHER: "•",
  };
  return symbols[type] || "•";
}

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
    openGraph: { title: name, description, images: card.profileImageUrl ? [card.profileImageUrl] : [], type: "profile" },
  };
}

export default async function PublicCardPage({ params, searchParams }: PageProps) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const card = await getCard(slug);

  if (!card) {
    const oldSlug = await prisma.slugRedirect.findUnique({ where: { oldSlug: slug }, select: { newSlug: true } });
    if (oldSlug) redirect("/p/" + oldSlug.newSlug);
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
  const userAgent = requestHeaders.get("user-agent") || "";
  const isBot = /bot|crawler|spider|preview|facebookexternalhit|slackbot/i.test(userAgent);

  if (!isBot) {
    const referrer = requestHeaders.get("referer");
    let referrerDomain: string | null = null;
    try { referrerDomain = referrer ? new URL(referrer).hostname.slice(0, 190) : null; } catch { referrerDomain = null; }
    const countryHeader = requestHeaders.get("x-vercel-ip-country");
    const countryCode = countryHeader && /^[A-Z]{2}$/.test(countryHeader) ? countryHeader : null;
    const eventTypes = query.source === "qr" ? ["PROFILE_VIEW", "QR_SCAN"] as const : ["PROFILE_VIEW"] as const;
    await prisma.analyticsEvent.createMany({
      data: eventTypes.map((eventType) => ({ businessCardId: card.id, eventType, countryCode, referrerDomain })),
    }).catch(() => undefined);
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
          const href = method.type === "PHONE" || method.type === "WHATSAPP" ? "tel:" + method.value
            : method.type === "EMAIL" ? "mailto:" + method.value
            : method.type === "WEBSITE" ? safeExternalUrl(method.value) : null;
          return (
            <div className={styles.contactItem} key={method.id}>
              <span className={styles.contactIcon} aria-hidden="true">{contactSymbol(method.type)}</span>
              <div className={styles.contactText}>
                <span>{method.label || method.type.toLowerCase()}</span>
                {href && href.startsWith("http")
                  ? <a href={"/api/cards/" + card.slug + "/links/" + method.id} target="_blank" rel="noreferrer">{method.value}</a>
                  : href ? <a href={href}>{method.value}</a> : <p>{method.value}</p>}
              </div>
            </div>
          );
        })}
        {card.address && <div className={styles.contactItem}><span className={styles.contactIcon} aria-hidden="true">⌖</span><div className={styles.contactText}><span>Address</span><p>{[card.address, card.city, card.region, card.country].filter(Boolean).join(", ")}</p></div></div>}
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

  return (
    <main className={styles.page}>
      <article className={styles.profile + " " + (styles[templateClass as keyof typeof styles] || "")}>
        {templateSlug === "minimal-professional" ? (
          <><div className={styles.minimalHeader}><span className={styles.minimalRule} />{identity}</div>{actions}{contactSection}{socialSection}</>
        ) : templateSlug === "executive-dark" ? (
          <><div className={styles.executiveHeader}>{cover}<div className={styles.executiveIdentity}>{identity}</div></div>{actions}{contactSection}{socialSection}</>
        ) : templateSlug === "creative-portfolio" ? (
          <><div className={styles.creativeHeader}>{cover}<div className={styles.creativeIdentity}>{identity}</div><span className={styles.creativeOrb} /></div>{actions}{contactSection}{socialSection}</>
        ) : templateSlug === "elegant-business" ? (
          <><div className={styles.elegantHeader}><span className={styles.elegantOverline}>PERSONAL PROFILE</span>{companyLogo && <span className={styles.elegantLogo}>{identity}</span>}{!companyLogo && identity}<span className={styles.elegantRule} /></div>{actions}{contactSection}{socialSection}</>
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
