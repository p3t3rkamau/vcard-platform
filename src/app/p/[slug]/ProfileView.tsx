import Link from "next/link";
import { dialableNumber, safeExternalUrl, whatsappLink } from "@/lib/http";
import ContactIcon, { SocialIcon } from "./ContactIcon";
import styles from "./profile.module.scss";

export type ProfileCard = {
  id: string;
  slug: string;
  displayName: string | null;
  firstName: string | null;
  lastName: string | null;
  jobTitle: string | null;
  companyName: string | null;
  bio: string | null;
  website: string | null;
  address: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  profileImageUrl: string | null;
  coverImageUrl: string | null;
  companyLogoUrl: string | null;
  contactMethods: Array<{ id: string; type: string; label: string | null; value: string }>;
  socialLinks: Array<{ id: string; platform: string; label: string | null; url: string }>;
};

type Row = { key: string; icon: string; label: string; value: string; href?: string; external?: boolean };

/** "Amina Wanjiru Mwangi" -> first "Amina Wanjiru", last "Mwangi" (themes style the two parts differently). */
function splitName(name: string) {
  const parts = name.trim().split(/\s+/);
  return parts.length < 2 ? { first: name, last: "" } : { first: parts.slice(0, -1).join(" "), last: parts[parts.length - 1] };
}

const mapsLink = (place: string) => "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(place);

type Props = { card: ProfileCard; templateSlug: string; reported?: boolean; jsonLd?: object | null };

export default function ProfileView({ card, templateSlug, reported = false, jsonLd = null }: Props) {
  const name = card.displayName || [card.firstName, card.lastName].filter(Boolean).join(" ") || "Your name";
  const { first, last } = splitName(name);
  const initials = name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  const themeClass = styles[templateSlug.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase()) as keyof typeof styles] || styles.modernCorporate;

  const website = safeExternalUrl(card.website);
  const profileImage = safeExternalUrl(card.profileImageUrl);
  const coverImage = safeExternalUrl(card.coverImageUrl);
  const companyLogo = safeExternalUrl(card.companyLogoUrl);

  // "Evergreen" uses the portrait as a full-bleed hero instead of a round avatar.
  const portraitHero = templateSlug === "modern-corporate";
  const heroImage = portraitHero ? profileImage || coverImage : coverImage;
  const role = card.jobTitle || card.companyName;

  // Primary actions: first phone number (or WhatsApp as a fallback) and first email address.
  const phone = card.contactMethods.find((method) => method.type === "PHONE" && dialableNumber(method.value));
  const whatsapp = card.contactMethods.find((method) => method.type === "WHATSAPP" && whatsappLink(method.value));
  const email = card.contactMethods.find((method) => method.type === "EMAIL");
  const call = phone
    ? { href: "tel:" + dialableNumber(phone.value), label: "Call", icon: "PHONE", external: false }
    : whatsapp ? { href: whatsappLink(whatsapp.value)!, label: "WhatsApp", icon: "WHATSAPP", external: true } : null;

  // Detail rows. Phone and email are listed too, so visitors can read and copy them (the pills only show "Call"/"Email").
  const place = [card.address, card.city, card.region, card.country].filter(Boolean).join(", ");
  const rows: Row[] = [];
  if (card.companyName) rows.push({ key: "company", icon: "COMPANY", label: "Company", value: card.companyName });
  if (place) rows.push({ key: "location", icon: "ADDRESS", label: "Location", value: place, href: mapsLink(place), external: true });
  if (website) rows.push({ key: "website", icon: "WEBSITE", label: "Website", value: website.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, ""), href: "/api/cards/" + card.slug + "/links/website", external: true });
  for (const method of card.contactMethods) {
    const label = method.label || { PHONE: "Phone", WHATSAPP: "WhatsApp", EMAIL: "Email", WEBSITE: "Website", ADDRESS: "Address", OTHER: "Other" }[method.type] || "Other";
    const row: Row = { key: method.id, icon: method.type, label, value: method.value };
    if (method.type === "PHONE" && dialableNumber(method.value)) row.href = "tel:" + dialableNumber(method.value);
    else if (method.type === "WHATSAPP" && whatsappLink(method.value)) { row.href = whatsappLink(method.value)!; row.external = true; }
    else if (method.type === "EMAIL") row.href = "mailto:" + method.value;
    else if (method.type === "WEBSITE") {
      const target = safeExternalUrl(method.value);
      if (!target || target === website) continue; // skip invalid links and duplicates of the main website
      row.href = "/api/cards/" + card.slug + "/links/" + method.id;
      row.external = true;
    } else if (method.type === "ADDRESS") { row.href = mapsLink(method.value); row.external = true; }
    rows.push(row);
  }

  const socials = card.socialLinks.filter((social) => safeExternalUrl(social.url));

  return (
    <main className={[styles.page, themeClass, heroImage ? styles.hasCover : ""].join(" ")}>
      {jsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />}
      <article className={styles.profile}>
        <header className={styles.header}>
          <div className={styles.cover} style={heroImage ? { backgroundImage: 'url("' + heroImage + '")' } : undefined}>
            {portraitHero && !heroImage && <span className={styles.heroInitials} aria-hidden="true">{initials}</span>}
          </div>
          {companyLogo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img className={styles.logo} src={companyLogo} alt={card.companyName ? card.companyName + " logo" : "Company logo"} />
          )}
          {!portraitHero && (
            <div className={styles.avatarWrap}>
              {profileImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img className={styles.avatar} src={profileImage} alt={name} width={640} height={640} />
              ) : <div className={styles.avatarFallback}>{initials}</div>}
            </div>
          )}
        </header>

        <div className={styles.body}>
          <div className={styles.identity}>
            <h1 className={styles.name}>
              <span className={styles.nameFirst}>{first}</span>
              {last && <>{" "}<span className={styles.nameLast}>{last}</span></>}
            </h1>
            {role && <p className={styles.role}>{role}</p>}
            <span className={styles.rule} aria-hidden="true" />
            {card.bio && <blockquote className={styles.quote}><p>{card.bio}</p></blockquote>}
          </div>

          {socials.length > 0 && (
            <nav className={styles.socials} aria-label="Social links">
              {socials.map((social) => (
                <a key={social.id} className={styles.tile} href={"/api/cards/" + card.slug + "/links/" + social.id} target="_blank" rel="noreferrer" aria-label={social.label || social.platform} title={social.label || social.platform}>
                  <SocialIcon platform={social.platform} />
                </a>
              ))}
            </nav>
          )}

          {(call || email) && (
            <div className={styles.ctas}>
              {call && <a className={styles.pillPrimary} href={call.href} aria-label={call.label + " " + (phone ?? whatsapp)?.value} {...(call.external ? { target: "_blank", rel: "noreferrer" } : {})}><ContactIcon type={call.icon} /> {call.label}</a>}
              {email && <a className={styles.pillSecondary} href={"mailto:" + email.value} aria-label={"Email " + email.value}><ContactIcon type="EMAIL" /> Email</a>}
            </div>
          )}
        </div>

        <div className={styles.sheet}>
          {rows.length > 0 && (
            <div className={styles.details}>
              {rows.map((row) => {
                const content = (
                  <>
                    <span className={styles.rowIcon}><ContactIcon type={row.icon} /></span>
                    <span className={styles.rowText}><small>{row.label}</small><strong>{row.value}</strong></span>
                    {row.href && <span className={styles.chev}><ContactIcon type="CHEVRON" /></span>}
                  </>
                );
                return row.href
                  ? <a key={row.key} className={styles.row} href={row.href} {...(row.external ? { target: "_blank", rel: "noreferrer" } : {})}>{content}</a>
                  : <div key={row.key} className={styles.row}>{content}</div>;
              })}
            </div>
          )}
          <a className={styles.save} href={"/api/cards/" + card.slug + "/vcard"}><ContactIcon type="SAVE" /> Save Contact</a>
        </div>

        <div className={styles.legal}>
          {reported && <p className={styles.reportSuccess}>Thank you. Your report has been submitted for review.</p>}
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
        </div>
      </article>
    </main>
  );
}
