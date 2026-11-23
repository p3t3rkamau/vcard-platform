"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { z } from "zod";
import { checkRateLimit } from "@/lib/rate-limit";
import { dialableNumber, safeExternalUrl } from "@/lib/http";
import { CARD_TEMPLATES } from "@/lib/templates";

// Abuse guards: there was previously no upper bound on cards, contacts or links per account.
const MAX_CARDS_PER_USER = 25;
const MAX_CONTACTS_PER_CARD = 15;
const MAX_SOCIALS_PER_CARD = 15;

const cardSchema = z.object({
  displayName: z.string().trim().min(2).max(80),
  jobTitle: z.string().trim().max(100).optional().default(""),
  companyName: z.string().trim().max(120).optional().default(""),
});

const detailsSchema = z.object({
  cardId: z.string().min(1),
  displayName: z.string().trim().min(2).max(80),
  jobTitle: z.string().trim().max(100),
  companyName: z.string().trim().max(120),
  bio: z.string().trim().max(500),
  website: z.string().trim().max(300),
  address: z.string().trim().max(200),
  city: z.string().trim().max(80),
  region: z.string().trim().max(80),
  country: z.string().trim().max(80),
});

const slugSchema = z.object({
  cardId: z.string().min(1),
  slug: z.string().trim().min(1).max(80),
});

async function requireUserId() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return session.user.id;
}

function toSlug(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "my-card";
}

// A slug is unavailable if a card uses it OR if it is a retired slug that redirects to another card.
async function slugIsTaken(slug: string, ownCardId?: string) {
  const [card, retired] = await Promise.all([
    prisma.businessCard.findUnique({ where: { slug }, select: { id: true } }),
    prisma.slugRedirect.findUnique({ where: { oldSlug: slug }, select: { businessCardId: true } }),
  ]);
  return Boolean(card) || Boolean(retired && retired.businessCardId !== ownCardId);
}

async function uniqueSlug(base: string) {
  let slug = toSlug(base);
  let suffix = 2;

  while (await slugIsTaken(slug)) {
    const ending = `-${suffix++}`;
    slug = `${toSlug(base).slice(0, 60 - ending.length)}${ending}`;
  }

  return slug;
}

function isUniqueViolation(error: unknown) {
  return typeof error === "object" && error !== null && (error as { code?: string }).code === "P2002";
}

async function enforceCardCreationLimits(userId: string) {
  const [count, allowed] = await Promise.all([
    prisma.businessCard.count({ where: { ownerId: userId, deletedAt: null } }),
    checkRateLimit(await headers(), "card-create", 20, 60 * 60 * 1000, userId),
  ]);
  if (count >= MAX_CARDS_PER_USER || !allowed) redirect("/dashboard?error=limit");
}

export async function createBusinessCard(formData: FormData) {
  const userId = await requireUserId();
  const parsed = cardSchema.safeParse({
    displayName: formData.get("displayName"),
    jobTitle: formData.get("jobTitle") ?? "",
    companyName: formData.get("companyName") ?? "",
  });

  if (!parsed.success) {
    redirect("/dashboard/cards/new?error=invalid");
  }

  await enforceCardCreationLimits(userId);

  // Two people creating "John Doe" at once could both pass the availability check; the unique
  // index then rejects one. Retry with a random suffix instead of showing a 500.
  let card: { id: string } | null = null;
  for (let attempt = 0; attempt < 3 && !card; attempt++) {
    const base = attempt === 0 ? parsed.data.displayName : parsed.data.displayName + "-" + Math.random().toString(36).slice(2, 6);
    try {
      card = await prisma.businessCard.create({
        data: {
          ownerId: userId,
          slug: await uniqueSlug(base),
          displayName: parsed.data.displayName,
          jobTitle: parsed.data.jobTitle || null,
          companyName: parsed.data.companyName || null,
        },
        select: { id: true },
      });
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
    }
  }
  if (!card) redirect("/dashboard/cards/new?error=invalid");

  revalidatePath("/dashboard");
  redirect(`/dashboard/cards/${card.id}/edit?created=1`);
}

export async function updateBusinessCardDetails(formData: FormData) {
  const userId = await requireUserId();
  const parsed = detailsSchema.safeParse({
    cardId: formData.get("cardId"),
    displayName: formData.get("displayName"),
    jobTitle: formData.get("jobTitle") ?? "",
    companyName: formData.get("companyName") ?? "",
    bio: formData.get("bio") ?? "",
    website: formData.get("website") ?? "",
    address: formData.get("address") ?? "",
    city: formData.get("city") ?? "",
    region: formData.get("region") ?? "",
    country: formData.get("country") ?? "",
  });

  if (!parsed.success) {
    redirect("/dashboard?error=invalid");
  }

  const { cardId, displayName, jobTitle, companyName, bio, website, address, city, region, country } = parsed.data;
  const card = await requireOwnedCard(cardId, userId);
  if (!card) redirect("/dashboard?error=not-found");

  // Accept "example.com" as well as "https://example.com"; reject javascript:, data:, etc.
  const normalizedWebsite = website ? safeExternalUrl(website) : null;
  if (website && !normalizedWebsite) redirect("/dashboard/cards/" + card.id + "/edit?error=website");

  await prisma.businessCard.update({
    where: { id: card.id },
    data: {
      displayName,
      jobTitle: jobTitle || null,
      companyName: companyName || null,
      bio: bio || null,
      website: normalizedWebsite,
      address: address || null,
      city: city || null,
      region: region || null,
      country: country || null,
      // Unchecked checkboxes are simply absent from FormData.
      isSearchable: formData.get("isSearchable") === "on",
    },
  });

  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/cards/${card.id}/edit`);
  revalidatePath(`/p/${card.slug}`);
  redirect("/dashboard?updated=1");
}

export async function updateCardSlug(formData: FormData) {
  const userId = await requireUserId();
  const parsed = slugSchema.safeParse({ cardId: formData.get("cardId"), slug: formData.get("slug") });
  if (!parsed.success) redirect("/dashboard?error=invalid");

  const card = await requireOwnedCard(parsed.data.cardId, userId);
  if (!card) redirect("/dashboard?error=not-found");
  const editPath = "/dashboard/cards/" + card.id + "/edit";

  const newSlug = toSlug(parsed.data.slug);
  if (newSlug.length < 3 || newSlug === "my-card") redirect(editPath + "?error=slug");
  if (newSlug === card.slug) redirect(editPath);

  if (!(await checkRateLimit(await headers(), "slug-change", 5, 24 * 60 * 60 * 1000, userId))) {
    redirect(editPath + "?error=slug-limit");
  }
  if (await slugIsTaken(newSlug, card.id)) redirect(editPath + "?error=slug-taken");

  try {
    await prisma.$transaction([
      // Taking back one of this card's own retired slugs: it is live again, so drop its redirect.
      prisma.slugRedirect.deleteMany({ where: { oldSlug: newSlug, businessCardId: card.id } }),
      // Point every older redirect straight at the newest slug (no redirect chains).
      prisma.slugRedirect.updateMany({ where: { businessCardId: card.id }, data: { newSlug } }),
      // Keep the previous URL (and any printed QR codes) working permanently.
      prisma.slugRedirect.create({ data: { businessCardId: card.id, oldSlug: card.slug, newSlug } }),
      prisma.businessCard.update({ where: { id: card.id }, data: { slug: newSlug } }),
    ]);
  } catch (error) {
    if (isUniqueViolation(error)) redirect(editPath + "?error=slug-taken");
    throw error;
  }

  revalidatePath("/dashboard");
  revalidatePath(editPath);
  revalidatePath("/p/" + card.slug);
  revalidatePath("/p/" + newSlug);
  redirect(editPath + "?slug=updated");
}

export async function duplicateBusinessCard(formData: FormData) {
  const userId = await requireUserId();
  const cardId = String(formData.get("cardId") ?? "");

  const source = await prisma.businessCard.findFirst({
    where: { id: cardId, ownerId: userId, deletedAt: null },
    include: {
      contactMethods: { orderBy: { sortOrder: "asc" } },
      socialLinks: { orderBy: { sortOrder: "asc" } },
      qrDesign: true,
    },
  });

  if (!source) redirect("/dashboard?error=not-found");
  await enforceCardCreationLimits(userId);

  const slug = await uniqueSlug(`${source.slug}-copy`);
  const duplicate = await prisma.businessCard.create({
    data: {
      ownerId: userId,
      slug,
      status: "DRAFT",
      firstName: source.firstName,
      lastName: source.lastName,
      displayName: source.displayName,
      jobTitle: source.jobTitle,
      companyName: source.companyName,
      bio: source.bio,
      profileImageUrl: source.profileImageUrl,
      coverImageUrl: source.coverImageUrl,
      companyLogoUrl: source.companyLogoUrl,
      website: source.website,
      address: source.address,
      city: source.city,
      region: source.region,
      country: source.country,
      templateId: source.templateId,
      isSearchable: source.isSearchable,
      contactMethods: {
        create: source.contactMethods.map(({ type, label, value, isPrimary, isVisible, sortOrder }) => ({
          type, label, value, isPrimary, isVisible, sortOrder,
        })),
      },
      socialLinks: {
        create: source.socialLinks.map(({ platform, label, url, isVisible, sortOrder }) => ({
          platform, label, url, isVisible, sortOrder,
        })),
      },
      ...(source.qrDesign ? {
        qrDesign: {
          create: {
            foregroundColor: source.qrDesign.foregroundColor,
            backgroundColor: source.qrDesign.backgroundColor,
            dotsType: source.qrDesign.dotsType,
            cornersSquareType: source.qrDesign.cornersSquareType,
            cornersDotType: source.qrDesign.cornersDotType,
            errorCorrectionLevel: source.qrDesign.errorCorrectionLevel,
            frameStyle: source.qrDesign.frameStyle,
            frameText: source.qrDesign.frameText,
            logoUrl: source.qrDesign.logoUrl,
          },
        },
      } : {}),
    },
    select: { id: true },
  });

  revalidatePath("/dashboard");
  redirect(`/dashboard/cards/${duplicate.id}/edit?duplicated=1`);
}

export async function publishBusinessCard(formData: FormData) {
  const userId = await requireUserId();
  const cardId = String(formData.get("cardId") ?? "");
  const card = await prisma.businessCard.findFirst({
    where: { id: cardId, ownerId: userId, deletedAt: null },
    select: { id: true, slug: true, displayName: true },
  });

  if (!card || !card.displayName?.trim()) redirect("/dashboard?error=publish");
  await prisma.businessCard.update({
    where: { id: card.id },
    data: { status: "PUBLISHED", publishedAt: new Date() },
  });

  revalidatePath("/dashboard");
  revalidatePath(`/p/${card.slug}`);
}

export async function unpublishBusinessCard(formData: FormData) {
  const userId = await requireUserId();
  const cardId = String(formData.get("cardId") ?? "");
  await prisma.businessCard.updateMany({
    where: { id: cardId, ownerId: userId, deletedAt: null },
    data: { status: "DRAFT" },
  });
  revalidatePath("/dashboard");
}

export async function archiveBusinessCard(formData: FormData) {
  const userId = await requireUserId();
  const cardId = String(formData.get("cardId") ?? "");

  await prisma.businessCard.updateMany({
    where: { id: cardId, ownerId: userId, deletedAt: null },
    data: { status: "ARCHIVED" },
  });

  revalidatePath("/dashboard");
}

export async function restoreBusinessCard(formData: FormData) {
  const userId = await requireUserId();
  const cardId = String(formData.get("cardId") ?? "");

  await prisma.businessCard.updateMany({
    where: { id: cardId, ownerId: userId, deletedAt: null },
    data: { status: "DRAFT" },
  });

  revalidatePath("/dashboard");
}

export async function deleteBusinessCard(formData: FormData) {
  const userId = await requireUserId();
  const cardId = String(formData.get("cardId") ?? "");

  await prisma.businessCard.updateMany({
    where: { id: cardId, ownerId: userId, deletedAt: null },
    data: { deletedAt: new Date(), status: "ARCHIVED" },
  });

  revalidatePath("/dashboard");
}


const contactSchema = z.object({
  cardId: z.string().min(1),
  type: z.enum(["PHONE", "EMAIL", "WHATSAPP", "WEBSITE", "ADDRESS", "OTHER"]),
  label: z.string().trim().max(40).optional().default(""),
  value: z.string().trim().min(2).max(254),
});

const socialSchema = z.object({
  cardId: z.string().min(1),
  platform: z.enum(["WhatsApp", "Facebook", "Instagram", "LinkedIn", "X", "TikTok", "YouTube", "Telegram", "Snapchat", "Pinterest", "GitHub", "Behance", "Dribbble", "Threads", "Other"]),
  label: z.string().trim().max(40).optional().default(""),
  url: z.string().trim().url().max(500),
});

async function requireOwnedCard(cardId: string, userId: string) {
  return prisma.businessCard.findFirst({
    where: { id: cardId, ownerId: userId, deletedAt: null },
    select: { id: true, slug: true },
  });
}

export async function addContactMethod(formData: FormData) {
  const userId = await requireUserId();
  const parsed = contactSchema.safeParse({
    cardId: formData.get("cardId"),
    type: formData.get("type"),
    label: formData.get("label") ?? "",
    value: formData.get("value"),
  });
  if (!parsed.success) redirect("/dashboard?error=contact");

  const card = await requireOwnedCard(parsed.data.cardId, userId);
  if (!card) redirect("/dashboard");
  if (parsed.data.type === "EMAIL" && !z.email().safeParse(parsed.data.value).success) {
    redirect("/dashboard/cards/" + card.id + "/edit?error=contact");
  }
  if (parsed.data.type === "PHONE" || parsed.data.type === "WHATSAPP") {
    // 7-15 digits (E.164 allows at most 15); keeps junk out of tel: links and the .vcf file.
    const digits = dialableNumber(parsed.data.value).replace(/\D/g, "");
    if (digits.length < 7 || digits.length > 15) redirect("/dashboard/cards/" + card.id + "/edit?error=contact");
  }
  // Accepts "example.com" and stores the normalized https URL.
  const websiteValue = parsed.data.type === "WEBSITE" ? safeExternalUrl(parsed.data.value) : null;
  if (parsed.data.type === "WEBSITE" && !websiteValue) {
    redirect("/dashboard/cards/" + card.id + "/edit?error=contact");
  }

  const sortOrder = await prisma.contactMethod.count({ where: { businessCardId: card.id } });
  if (sortOrder >= MAX_CONTACTS_PER_CARD) redirect("/dashboard/cards/" + card.id + "/edit?error=limit");
  await prisma.contactMethod.create({
    data: {
      businessCardId: card.id,
      type: parsed.data.type,
      label: parsed.data.label || null,
      value: websiteValue ?? parsed.data.value,
      isPrimary: sortOrder === 0,
      sortOrder,
    },
  });
  revalidatePath("/dashboard/cards/" + card.id + "/edit");
  revalidatePath("/dashboard");
  redirect("/dashboard/cards/" + card.id + "/edit?contact=added");
}

export async function removeContactMethod(formData: FormData) {
  const userId = await requireUserId();
  const cardId = String(formData.get("cardId") ?? "");
  const methodId = String(formData.get("methodId") ?? "");
  const card = await requireOwnedCard(cardId, userId);
  if (!card) redirect("/dashboard");
  await prisma.contactMethod.deleteMany({ where: { id: methodId, businessCardId: card.id } });
  revalidatePath("/dashboard/cards/" + card.id + "/edit");
}

export async function addSocialLink(formData: FormData) {
  const userId = await requireUserId();
  const parsed = socialSchema.safeParse({
    cardId: formData.get("cardId"),
    platform: formData.get("platform"),
    label: formData.get("label") ?? "",
    url: formData.get("url"),
  });
  if (!parsed.success) redirect("/dashboard?error=social");

  const card = await requireOwnedCard(parsed.data.cardId, userId);
  if (!card) redirect("/dashboard");
  const socialUrl = safeExternalUrl(parsed.data.url);
  if (!socialUrl) {
    redirect("/dashboard/cards/" + card.id + "/edit?error=social");
  }

  const sortOrder = await prisma.socialLink.count({ where: { businessCardId: card.id } });
  if (sortOrder >= MAX_SOCIALS_PER_CARD) redirect("/dashboard/cards/" + card.id + "/edit?error=limit");
  await prisma.socialLink.create({
    data: {
      businessCardId: card.id,
      platform: parsed.data.platform,
      label: parsed.data.label || null,
      url: socialUrl,
      sortOrder,
    },
  });
  revalidatePath("/dashboard/cards/" + card.id + "/edit");
  revalidatePath("/dashboard");
  redirect("/dashboard/cards/" + card.id + "/edit?social=added");
}

export async function removeSocialLink(formData: FormData) {
  const userId = await requireUserId();
  const cardId = String(formData.get("cardId") ?? "");
  const socialId = String(formData.get("socialId") ?? "");
  const card = await requireOwnedCard(cardId, userId);
  if (!card) redirect("/dashboard");
  await prisma.socialLink.deleteMany({ where: { id: socialId, businessCardId: card.id } });
  revalidatePath("/dashboard/cards/" + card.id + "/edit");
}


export async function updateCardTemplate(formData: FormData) {
  const userId = await requireUserId();
  const cardId = String(formData.get("cardId") ?? "");
  const templateSlug = String(formData.get("templateSlug") ?? "");
  if (!CARD_TEMPLATES.some((template) => template.slug === templateSlug)) redirect("/dashboard");

  const card = await requireOwnedCard(cardId, userId);
  if (!card) redirect("/dashboard");

  const template = await prisma.template.findUnique({
    where: { slug: templateSlug },
    select: { id: true },
  });
  if (!template) redirect("/dashboard/cards/" + card.id + "/edit?error=template");

  await prisma.businessCard.update({
    where: { id: card.id },
    data: { templateId: template.id },
  });

  revalidatePath("/dashboard/cards/" + card.id + "/edit");
  revalidatePath("/p/" + card.slug);
  redirect("/dashboard/cards/" + card.id + "/edit?template=updated");
}
