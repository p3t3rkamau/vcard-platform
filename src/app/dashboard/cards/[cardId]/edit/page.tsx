import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  addContactMethod,
  addSocialLink,
  removeContactMethod,
  removeSocialLink,
  updateBusinessCardDetails,
  updateCardSlug,
  updateCardTemplate,
} from "../../../actions";
import styles from "../../../dashboard.module.scss";
import formStyles from "../../new/new-card.module.scss";
import { ensureDefaultTemplates } from "@/lib/templates";
import QRStudio from "@/components/qr/QRStudio";
import { assignCardToOrganization } from "@/app/dashboard/organizations/actions";

type EditCardPageProps = {
  params: Promise<{ cardId: string }>;
  searchParams: Promise<{ created?: string; duplicated?: string; contact?: string; social?: string; template?: string; media?: string; mediaType?: string; reason?: string; organization?: string; slug?: string; error?: string }>;
};

export default async function EditCardPage({ params, searchParams }: EditCardPageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const [{ cardId }, query] = await Promise.all([params, searchParams]);
  await ensureDefaultTemplates();
  const card = await prisma.businessCard.findFirst({
    where: { id: cardId, ownerId: session.user.id, deletedAt: null },
    include: {
      contactMethods: { orderBy: { sortOrder: "asc" } },
      socialLinks: { orderBy: { sortOrder: "asc" } },
      template: true,
      qrDesign: true,
    },
  });
  if (!card) notFound();
  const [templates, memberships] = await Promise.all([
    prisma.template.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }),
    prisma.organizationMember.findMany({ where: { userId: session.user.id, role: { not: "VIEWER" } }, include: { organization: { select: { id: true, name: true } } }, orderBy: { joinedAt: "asc" } }),
  ]);
  const requestHeaders = await headers();
  const forwardedHost = requestHeaders.get("x-forwarded-host")?.split(",")[0]?.trim();
  const requestHost = forwardedHost || requestHeaders.get("host")?.split(",")[0]?.trim();
  const forwardedProtocol = requestHeaders.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const requestProtocol = forwardedProtocol || (requestHost?.startsWith("localhost") ? "http" : "https");
  const requestOrigin = requestHost ? requestProtocol + "://" + requestHost : null;

  // Ignore a localhost app URL when the request is coming from a deployed hostname.
  const configuredAppUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  const configuredIsLocal = configuredAppUrl
    ? /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(configuredAppUrl)
    : false;
  const appBaseUrl = (
    configuredAppUrl && !configuredIsLocal
      ? configuredAppUrl
      : requestOrigin || configuredAppUrl || "http://localhost:3000"
  ).replace(/\/$/, "");

  return (
    <main className={styles.shell}>
      <Link className={styles.brand} href="/dashboard">VCARD PLATFORM</Link>
      <section className={formStyles.panel}>
        <Link href="/dashboard" className={formStyles.back}>← Back to dashboard</Link>
        <span className={formStyles.eyebrow}>CARD BUILDER · STEP 1</span>
        <h1>{card.displayName || "Your digital card"}</h1>
        <p className={formStyles.intro}>
          Your profile address is <strong>/p/{card.slug}</strong>. Updating your details will not change it,
          and if you ever choose a new address, your old link and printed QR codes keep working.
        </p>

        {query.created === "1" && <p className={formStyles.success}>Your digital card has been created.</p>}
        {query.duplicated === "1" && <p className={formStyles.success}>A draft copy has been created.</p>}
        {query.contact === "added" && <p className={formStyles.success}>Contact method added.</p>}
        {query.social === "added" && <p className={formStyles.success}>Social link added.</p>}
        {query.template === "updated" && <p className={formStyles.success}>Your card design has been updated.</p>}
        {query.media === "uploaded" && <p className={formStyles.success}>{query.mediaType?.replaceAll("_", " ").toLowerCase()} uploaded successfully.</p>}
        {query.media === "not-configured" && <p className={formStyles.error}>The public image store is not connected. Create a Public Vercel Blob store and add its token as VCARD_BLOB_READ_WRITE_TOKEN in this environment.</p>}
        {query.media === "invalid-file" && <p className={formStyles.error}>Choose a JPG, PNG or WebP image smaller than 4 MB.</p>}
        {query.media === "failed" && query.reason === "blob" && <p className={formStyles.error}>The public image store rejected the upload. Confirm that VCARD_BLOB_READ_WRITE_TOKEN belongs to the new Public Blob store. The server log contains the exact error.</p>}
        {query.media === "failed" && query.reason === "database" && <p className={formStyles.error}>The image reached Blob storage, but the profile could not be updated in the database. Check the Neon connection and server logs.</p>}
        {query.media === "failed" && !query.reason && <p className={formStyles.error}>The image could not be uploaded. Check the server logs for the upload error.</p>}
        {query.media === "rate-limited" && <p className={formStyles.error}>You have uploaded too many images recently. Please try again later.</p>}
        {query.organization === "updated" && <p className={formStyles.success}>Organization assignment updated.</p>}
        {query.error === "organization" && <p className={formStyles.error}>You do not have permission to link this card to that organization.</p>}
        {query.slug === "updated" && <p className={formStyles.success}>Your profile address has been updated. The old address redirects here.</p>}
        {query.error === "slug" && <p className={formStyles.error}>Use at least 3 letters or numbers for your address.</p>}
        {query.error === "slug-taken" && <p className={formStyles.error}>That address is already taken. Try another one.</p>}
        {query.error === "slug-limit" && <p className={formStyles.error}>You can change your address up to 5 times per day. Please try again tomorrow.</p>}
        {query.error === "website" && <p className={formStyles.error}>Enter a valid website address, such as example.com.</p>}
        {query.error === "limit" && <p className={formStyles.error}>You have reached the limit for this card. Remove something before adding more.</p>}
        {query.error && !["organization", "slug", "slug-taken", "slug-limit", "website", "limit"].includes(query.error) && <p className={formStyles.error}>Please check the information and try again.</p>}

        <div className={formStyles.section}>
          <div className={formStyles.sectionHeading}>
            <div><span className={formStyles.step}>DESIGN</span><h2>Choose a template</h2></div>
            <span className={formStyles.count}>{templates.length} designs</span>
          </div>
          <p className={formStyles.helper}>Switch designs at any time. Your profile details, contacts and social links stay unchanged.</p>
          <form action={updateCardTemplate} className={formStyles.templateGrid}>
            <input type="hidden" name="cardId" value={card.id} />
            {templates.map((template) => (
              <label className={formStyles.templateOption} key={template.id}>
                <input type="radio" name="templateSlug" value={template.slug} defaultChecked={card.template?.slug === template.slug || (!card.template && template.slug === "modern-corporate")} />
                <span className={formStyles.templateSwatch + " " + formStyles[template.slug as keyof typeof formStyles]} aria-hidden="true" />
                <strong>{template.name}</strong>
                <small>{template.description}</small>
              </label>
            ))}
            <button type="submit">Apply selected design</button>
          </form>
        </div>

        <div className={formStyles.section}>
          <div className={formStyles.sectionHeading}>
            <div><span className={formStyles.step}>BRANDING</span><h2>Profile images</h2></div>
            <span className={formStyles.count}>JPG · PNG · WebP · 4 MB max · auto-optimized</span>
          </div>
          <div className={formStyles.mediaGrid}>
            {([
              { type: "PROFILE_IMAGE", label: "Profile photo", url: card.profileImageUrl },
              { type: "COVER_IMAGE", label: "Cover image", url: card.coverImageUrl },
              { type: "COMPANY_LOGO", label: "Company logo", url: card.companyLogoUrl },
            ] as const).map((item) => (
              <div className={formStyles.mediaCard} key={item.type}>
                <strong>{item.label}</strong>
                {item.url ? <img src={item.url} alt={item.label} loading="lazy" /> : <div className={formStyles.mediaPlaceholder}>No image uploaded</div>}
                <form action={"/api/cards/" + card.id + "/media"} method="post" encType="multipart/form-data">
                  <input type="hidden" name="type" value={item.type} />
                  <input type="file" name="file" accept="image/jpeg,image/png,image/webp" required />
                  <button type="submit">Upload {item.label.toLowerCase()}</button>
                </form>
              </div>
            ))}
          </div>
        </div>

        <div className={formStyles.section}>
          <div className={formStyles.sectionHeading}>
            <div><span className={formStyles.step}>COMPANY</span><h2>Organization</h2></div>
          </div>
          <p className={formStyles.helper}>Link this card to a company workspace so it appears in the employee directory.</p>
          <form action={assignCardToOrganization} className={formStyles.addForm}>
            <input type="hidden" name="cardId" value={card.id} />
            <label>Organization
              <select name="organizationId" defaultValue={card.organizationId || ""}>
                <option value="">Personal card (not linked)</option>
                {memberships.map((membership) => <option key={membership.organization.id} value={membership.organization.id}>{membership.organization.name}</option>)}
              </select>
            </label>
            <button type="submit">Save organization</button>
          </form>
        </div>

        <QRStudio
          cardId={card.id}
          slug={card.slug}
          profileUrl={appBaseUrl + "/p/" + card.slug}
          profileImageUrl={card.profileImageUrl}
          companyLogoUrl={card.companyLogoUrl}
          initialDesign={{
            foregroundColor: card.qrDesign?.foregroundColor || "#111827",
            backgroundColor: card.qrDesign?.backgroundColor || "#FFFFFF",
            dotsType: card.qrDesign?.dotsType || "rounded",
            cornersSquareType: card.qrDesign?.cornersSquareType || "extra-rounded",
            cornersDotType: card.qrDesign?.cornersDotType || "dot",
            errorCorrectionLevel: card.qrDesign?.errorCorrectionLevel || "H",
            frameStyle: card.qrDesign?.frameStyle || "none",
            frameText: card.qrDesign?.frameText || "SCAN TO CONNECT",
            logoUrl: card.qrDesign?.logoUrl || null,
          }}
        />

        <div className={formStyles.section}>
          <div className={formStyles.sectionHeading}>
            <div><span className={formStyles.step}>ADDRESS</span><h2>Profile address</h2></div>
          </div>
          <p className={formStyles.helper}>Your old address will keep redirecting here, so shared links and printed QR codes never break.</p>
          <form action={updateCardSlug} className={formStyles.addForm}>
            <input type="hidden" name="cardId" value={card.id} />
            <label>Address
              <span className={formStyles.slugRow}>
                <span>{appBaseUrl.replace(/^https?:\/\//, "")}/p/</span>
                <input name="slug" required minLength={3} maxLength={60} defaultValue={card.slug} autoCapitalize="none" spellCheck={false} />
              </span>
            </label>
            <button type="submit">Update address</button>
          </form>
        </div>

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
          <label>
            Website
            <input name="website" maxLength={300} defaultValue={card.website ?? ""} placeholder="example.com" inputMode="url" autoComplete="url" />
          </label>
          <label>
            Street address
            <input name="address" maxLength={200} defaultValue={card.address ?? ""} autoComplete="street-address" />
          </label>
          <div className={formStyles.twoCol}>
            <label>City<input name="city" maxLength={80} defaultValue={card.city ?? ""} autoComplete="address-level2" /></label>
            <label>Region / county<input name="region" maxLength={80} defaultValue={card.region ?? ""} autoComplete="address-level1" /></label>
            <label>Country<input name="country" maxLength={80} defaultValue={card.country ?? ""} autoComplete="country-name" /></label>
          </div>
          <label className={formStyles.checkRow}>
            <input type="checkbox" name="isSearchable" defaultChecked={card.isSearchable} />
            <b>Allow search engines to list this card
              <small>When off, Google and others are asked not to index your page. Anyone with your link or QR code can still open it.</small>
            </b>
          </label>
          <p className={formStyles.helper}>Current status: {card.status.toLowerCase()}.</p>
          <button type="submit">Save profile details <span aria-hidden="true">→</span></button>
        </form>

        <div className={formStyles.section}>
          <div className={formStyles.sectionHeading}>
            <div><span className={formStyles.step}>STEP 2</span><h2>Contact methods</h2></div>
            <span className={formStyles.count}>{card.contactMethods.length} added</span>
          </div>
          {card.contactMethods.length > 0 ? (
            <div className={formStyles.records}>
              {card.contactMethods.map((method) => (
                <div className={formStyles.record} key={method.id}>
                  <div><strong>{method.label || method.type.toLowerCase()}</strong><span>{method.value}</span></div>
                  <form action={removeContactMethod}>
                    <input type="hidden" name="cardId" value={card.id} />
                    <input type="hidden" name="methodId" value={method.id} />
                    <button className={formStyles.removeButton} type="submit" aria-label={"Remove " + method.value}>Remove</button>
                  </form>
                </div>
              ))}
            </div>
          ) : <p className={formStyles.helper}>Add phone numbers, email addresses, WhatsApp or your website.</p>}
          <form action={addContactMethod} className={formStyles.addForm}>
            <input type="hidden" name="cardId" value={card.id} />
            <label>Type
              <select name="type" defaultValue="PHONE">
                <option value="PHONE">Phone</option><option value="EMAIL">Email</option>
                <option value="WHATSAPP">WhatsApp</option><option value="WEBSITE">Website</option>
                <option value="ADDRESS">Address</option><option value="OTHER">Other</option>
              </select>
            </label>
            <label>Label (optional)<input name="label" maxLength={40} placeholder="e.g. Office" /></label>
            <label>Value<input name="value" required maxLength={254} placeholder="Phone number, email or URL" /></label>
            <button type="submit">＋ Add contact method</button>
          </form>
        </div>

        <div className={formStyles.section}>
          <div className={formStyles.sectionHeading}>
            <div><span className={formStyles.step}>STEP 3</span><h2>Social profiles</h2></div>
            <span className={formStyles.count}>{card.socialLinks.length} added</span>
          </div>
          {card.socialLinks.length > 0 ? (
            <div className={formStyles.records}>
              {card.socialLinks.map((social) => (
                <div className={formStyles.record} key={social.id}>
                  <div><strong>{social.label || social.platform}</strong><span>{social.url}</span></div>
                  <form action={removeSocialLink}>
                    <input type="hidden" name="cardId" value={card.id} />
                    <input type="hidden" name="socialId" value={social.id} />
                    <button className={formStyles.removeButton} type="submit" aria-label={"Remove " + social.platform}>Remove</button>
                  </form>
                </div>
              ))}
            </div>
          ) : <p className={formStyles.helper}>Add the social platforms where people can connect with you.</p>}
          <form action={addSocialLink} className={formStyles.addForm}>
            <input type="hidden" name="cardId" value={card.id} />
            <label>Platform
              <select name="platform" defaultValue="LinkedIn">
                {["WhatsApp","Facebook","Instagram","LinkedIn","X","TikTok","YouTube","Telegram","Snapchat","Pinterest","GitHub","Behance","Dribbble","Threads","Other"].map((platform) => <option key={platform} value={platform}>{platform}</option>)}
              </select>
            </label>
            <label>Display label (optional)<input name="label" maxLength={40} placeholder="e.g. My portfolio" /></label>
            <label>Profile URL<input name="url" type="url" required maxLength={500} placeholder="https://..." /></label>
            <button type="submit">＋ Add social profile</button>
          </form>
        </div>
      </section>
    </main>
  );
}
