import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  addContactMethod,
  addSocialLink,
  removeContactMethod,
  removeSocialLink,
  updateBusinessCardDetails,
  updateCardTemplate,
} from "../../../actions";
import styles from "../../../dashboard.module.scss";
import formStyles from "../../new/new-card.module.scss";
import { ensureDefaultTemplates } from "@/lib/templates";

type EditCardPageProps = {
  params: Promise<{ cardId: string }>;
  searchParams: Promise<{ created?: string; duplicated?: string; contact?: string; social?: string; template?: string; error?: string }>;
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
    },
  });
  if (!card) notFound();
  const templates = await prisma.template.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } });

  return (
    <main className={styles.shell}>
      <Link className={styles.brand} href="/dashboard">VCARD PLATFORM</Link>
      <section className={formStyles.panel}>
        <Link href="/dashboard" className={formStyles.back}>← Back to dashboard</Link>
        <span className={formStyles.eyebrow}>CARD BUILDER · STEP 1</span>
        <h1>{card.displayName || "Your digital card"}</h1>
        <p className={formStyles.intro}>
          Your profile address is permanent: <strong>/p/{card.slug}</strong>.
          Updating your details will not change this address.
        </p>

        {query.created === "1" && <p className={formStyles.success}>Your digital card has been created.</p>}
        {query.duplicated === "1" && <p className={formStyles.success}>A draft copy has been created.</p>}
        {query.contact === "added" && <p className={formStyles.success}>Contact method added.</p>}
        {query.social === "added" && <p className={formStyles.success}>Social link added.</p>}
        {query.template === "updated" && <p className={formStyles.success}>Your card design has been updated.</p>}
        {query.error && <p className={formStyles.error}>Please check the information and try again.</p>}

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
