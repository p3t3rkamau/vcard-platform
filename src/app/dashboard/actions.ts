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
