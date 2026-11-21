"use server";

import { auth } from "@/auth";
import { isAdminEmail } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id || !isAdminEmail(session.user.email)) redirect("/dashboard");
  return session.user.id;
}

export async function updateReportStatus(formData: FormData) {
  const adminId = await requireAdmin();
  const parsed = z.object({
    reportId: z.string().min(1),
    status: z.enum(["REVIEWED", "DISMISSED", "ACTIONED"]),
  }).safeParse({ reportId: formData.get("reportId"), status: formData.get("status") });
  if (!parsed.success) redirect("/dashboard/admin");

  await prisma.profileReport.update({
    where: { id: parsed.data.reportId },
    data: { status: parsed.data.status, reviewedById: adminId },
  });
  revalidatePath("/dashboard/admin");
}

export async function moderateCard(formData: FormData) {
  await requireAdmin();
  const parsed = z.object({
    cardId: z.string().min(1),
    action: z.enum(["UNPUBLISH", "RESTORE", "SOFT_DELETE", "HIDE_FROM_SEARCH"]),
  }).safeParse({ cardId: formData.get("cardId"), action: formData.get("action") });
  if (!parsed.success) redirect("/dashboard/admin");

  const card = await prisma.businessCard.findUnique({ where: { id: parsed.data.cardId }, select: { id: true, slug: true } });
  if (!card) redirect("/dashboard/admin");

  if (parsed.data.action === "UNPUBLISH") {
    await prisma.businessCard.update({ where: { id: card.id }, data: { status: "DRAFT" } });
  } else if (parsed.data.action === "RESTORE") {
    await prisma.businessCard.update({ where: { id: card.id }, data: { deletedAt: null, status: "DRAFT" } });
  } else if (parsed.data.action === "SOFT_DELETE") {
    await prisma.businessCard.update({ where: { id: card.id }, data: { deletedAt: new Date(), status: "ARCHIVED" } });
  } else {
    await prisma.businessCard.update({ where: { id: card.id }, data: { isSearchable: false } });
  }

  revalidatePath("/dashboard/admin");
  revalidatePath("/p/" + card.slug);
}
