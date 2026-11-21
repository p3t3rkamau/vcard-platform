"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

async function requireUserId() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return session.user.id;
}

function toSlug(value: string) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "organization";
}

async function uniqueOrganizationSlug(name: string) {
  const base = toSlug(name);
  let slug = base;
  let suffix = 2;
  while (await prisma.organization.findUnique({ where: { slug }, select: { id: true } })) {
    const ending = "-" + suffix++;
    slug = base.slice(0, 60 - ending.length) + ending;
  }
  return slug;
}

async function getManager(organizationId: string, userId: string) {
  return prisma.organizationMember.findUnique({
    where: { organizationId_userId: { organizationId, userId } },
    select: { role: true },
  });
}

export async function createOrganization(formData: FormData) {
  const userId = await requireUserId();
  const parsed = z.object({ name: z.string().trim().min(2).max(100) }).safeParse({
    name: formData.get("name"),
  });
  if (!parsed.success) redirect("/dashboard/organizations?error=invalid");

  const slug = await uniqueOrganizationSlug(parsed.data.name);
  const organization = await prisma.organization.create({
    data: {
      name: parsed.data.name,
      slug,
      createdById: userId,
      members: { create: { userId, role: "OWNER" } },
    },
    select: { id: true },
  });
  revalidatePath("/dashboard");
  redirect("/dashboard/organizations/" + organization.id + "?created=1");
}

export async function addOrganizationMember(formData: FormData) {
  const userId = await requireUserId();
  const parsed = z.object({
    organizationId: z.string().min(1),
    email: z.string().trim().email().max(254),
    role: z.enum(["ADMIN", "EDITOR", "VIEWER"]),
  }).safeParse({
    organizationId: formData.get("organizationId"),
    email: formData.get("email"),
    role: formData.get("role"),
  });
  if (!parsed.success) redirect("/dashboard/organizations?error=invalid");

  const manager = await getManager(parsed.data.organizationId, userId);
  if (!manager || !["OWNER", "ADMIN"].includes(manager.role)) redirect("/dashboard/organizations");
  if (parsed.data.role === "ADMIN" && manager.role !== "OWNER") redirect("/dashboard/organizations");

  const memberUser = await prisma.user.findUnique({
    where: { email: parsed.data.email.toLowerCase() },
    select: { id: true },
  });
  if (!memberUser) redirect("/dashboard/organizations/" + parsed.data.organizationId + "?error=user-not-found");
  if (memberUser.id === userId) redirect("/dashboard/organizations/" + parsed.data.organizationId + "?error=already-member");

  await prisma.organizationMember.upsert({
    where: { organizationId_userId: { organizationId: parsed.data.organizationId, userId: memberUser.id } },
    update: { role: parsed.data.role },
    create: { organizationId: parsed.data.organizationId, userId: memberUser.id, role: parsed.data.role },
  });

  revalidatePath("/dashboard/organizations/" + parsed.data.organizationId);
  redirect("/dashboard/organizations/" + parsed.data.organizationId + "?member=added");
}

export async function updateOrganizationMemberRole(formData: FormData) {
  const userId = await requireUserId();
  const parsed = z.object({
    organizationId: z.string().min(1),
    memberId: z.string().min(1),
    role: z.enum(["ADMIN", "EDITOR", "VIEWER"]),
  }).safeParse({
    organizationId: formData.get("organizationId"),
    memberId: formData.get("memberId"),
    role: formData.get("role"),
  });
  if (!parsed.success) redirect("/dashboard/organizations");

  const manager = await getManager(parsed.data.organizationId, userId);
  if (manager?.role !== "OWNER") redirect("/dashboard/organizations");

  const member = await prisma.organizationMember.findFirst({
    where: { id: parsed.data.memberId, organizationId: parsed.data.organizationId },
    select: { role: true },
  });
  if (!member || member.role === "OWNER") redirect("/dashboard/organizations/" + parsed.data.organizationId);

  await prisma.organizationMember.update({
    where: { id: parsed.data.memberId },
    data: { role: parsed.data.role },
  });
  revalidatePath("/dashboard/organizations/" + parsed.data.organizationId);
}

export async function removeOrganizationMember(formData: FormData) {
  const userId = await requireUserId();
  const organizationId = String(formData.get("organizationId") ?? "");
  const memberId = String(formData.get("memberId") ?? "");
  const manager = await getManager(organizationId, userId);
  if (!manager || !["OWNER", "ADMIN"].includes(manager.role)) redirect("/dashboard/organizations");

  const member = await prisma.organizationMember.findFirst({
    where: { id: memberId, organizationId },
    select: { id: true, role: true },
  });
  if (!member || member.role === "OWNER" || (manager.role === "ADMIN" && member.role === "ADMIN")) {
    redirect("/dashboard/organizations/" + organizationId);
  }

  await prisma.organizationMember.delete({ where: { id: member.id } });
  revalidatePath("/dashboard/organizations/" + organizationId);
}

export async function assignCardToOrganization(formData: FormData) {
  const userId = await requireUserId();
  const cardId = String(formData.get("cardId") ?? "");
  const organizationId = String(formData.get("organizationId") ?? "");

  const card = await prisma.businessCard.findFirst({
    where: { id: cardId, ownerId: userId, deletedAt: null },
    select: { id: true, slug: true },
  });
  if (!card) redirect("/dashboard");

  if (organizationId) {
    const membership = await getManager(organizationId, userId);
    if (!membership || membership.role === "VIEWER") redirect("/dashboard/cards/" + card.id + "/edit?error=organization");
  }

  await prisma.businessCard.update({
    where: { id: card.id },
    data: { organizationId: organizationId || null },
  });
  revalidatePath("/dashboard/cards/" + card.id + "/edit");
  revalidatePath("/dashboard/organizations");
  revalidatePath("/p/" + card.slug);
  redirect("/dashboard/cards/" + card.id + "/edit?organization=updated");
}
