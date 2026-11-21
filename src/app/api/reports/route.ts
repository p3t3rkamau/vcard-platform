import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";
import { checkRateLimit } from "@/lib/rate-limit";

const reportSchema = z.object({
  cardId: z.string().min(1),
  reason: z.enum(["SPAM", "IMPERSONATION", "ABUSIVE", "MISLEADING", "OTHER"]),
  details: z.string().trim().max(500).optional().default(""),
  website: z.string().optional().default(""),
});

export async function POST(request: Request) {
  let formData: FormData;
  try { formData = await request.formData(); } catch { return NextResponse.json({ error: "Invalid report" }, { status: 400 }); }

  const parsed = reportSchema.safeParse({
    cardId: formData.get("cardId"),
    reason: formData.get("reason"),
    details: formData.get("details") ?? "",
    website: formData.get("website") ?? "",
  });
  if (!parsed.success || parsed.data.website) return NextResponse.json({ error: "Invalid report" }, { status: 400 });

  if (!(await checkRateLimit(request, "profile-report-global", 10, 60 * 60 * 1000)) || !(await checkRateLimit(request, "profile-report", 3, 60 * 60 * 1000, parsed.data.cardId))) {
    return NextResponse.json({ error: "Too many reports. Please try again later." }, { status: 429 });
  }

  const card = await prisma.businessCard.findFirst({
    where: { id: parsed.data.cardId, status: "PUBLISHED", deletedAt: null },
    select: { id: true, slug: true },
  });
  if (!card) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  const session = await auth();
  await prisma.profileReport.create({
    data: {
      businessCardId: card.id,
      reporterUserId: session?.user?.id || null,
      reason: parsed.data.reason,
      details: parsed.data.details || null,
    },
  });

  return NextResponse.redirect(new URL("/p/" + card.slug + "?reported=1", request.url), 303);
}
