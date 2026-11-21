"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

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

async function uniqueSlug(base: string) {
  let slug = toSlug(base);
  let suffix = 2;

  while (await prisma.businessCard.findUnique({ where: { slug }, select: { id: true } })) {
    const ending = `-${suffix++}`;
    slug = `${toSlug(base).slice(0, 60 - ending.length)}${ending}`;
  }

  return slug;
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

  const slug = await uniqueSlug(parsed.data.displayName);
  const card = await prisma.businessCard.create({
    data: {
      ownerId: userId,
      slug,
      displayName: parsed.data.displayName,
      jobTitle: parsed.data.jobTitle || null,
      companyName: parsed.data.companyName || null,
    },
    select: { id: true },
  });

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
  });

  if (!parsed.success) {
    redirect("/dashboard?error=invalid");
  }

  const { cardId, displayName, jobTitle, companyName, bio } = parsed.data;
  await prisma.businessCard.updateMany({
    where: { id: cardId, ownerId: userId, deletedAt: null },
    data: {
      displayName,
      jobTitle: jobTitle || null,
      companyName: companyName || null,
      bio: bio || null,
    },
  });

  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/cards/${cardId}/edit`);
  redirect("/dashboard?updated=1");
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
    select: { id: true },
  });
}

function isSafeWebUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
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
  if (parsed.data.type === "WEBSITE" && !isSafeWebUrl(parsed.data.value)) {
    redirect("/dashboard/cards/" + card.id + "/edit?error=contact");
  }

  const sortOrder = await prisma.contactMethod.count({ where: { businessCardId: card.id } });
  await prisma.contactMethod.create({
    data: {
      businessCardId: card.id,
      type: parsed.data.type,
      label: parsed.data.label || null,
      value: parsed.data.value,
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
  if (!isSafeWebUrl(parsed.data.url)) {
    redirect("/dashboard/cards/" + card.id + "/edit?error=social");
  }

  const sortOrder = await prisma.socialLink.count({ where: { businessCardId: card.id } });
  await prisma.socialLink.create({
    data: {
      businessCardId: card.id,
      platform: parsed.data.platform,
      label: parsed.data.label || null,
      url: parsed.data.url,
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
  const allowedSlugs = [
    "modern-corporate", "minimal-professional", "executive-dark", "creative-portfolio",
    "elegant-business", "gradient-modern", "personal-branding", "luxury-corporate",
  ];
  if (!allowedSlugs.includes(templateSlug)) redirect("/dashboard");

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
  revalidatePath("/p");
  redirect("/dashboard/cards/" + card.id + "/edit?template=updated");
}
