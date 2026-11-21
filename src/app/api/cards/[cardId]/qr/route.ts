import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

type RouteProps = { params: Promise<{ cardId: string }> };

const qrSchema = z.object({
  foregroundColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  backgroundColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  dotsType: z.enum(["square", "dots", "rounded", "classy", "classy-rounded", "extra-rounded"]),
  cornersSquareType: z.enum(["square", "dot", "extra-rounded"]),
  cornersDotType: z.enum(["square", "dot"]),
  errorCorrectionLevel: z.enum(["L", "M", "Q", "H"]),
  frameStyle: z.enum(["none", "label", "border"]),
  frameText: z.string().trim().max(40),
  logoChoice: z.enum(["none", "profile", "company"]),
});

export async function PUT(request: Request, { params }: RouteProps) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { cardId } = await params;
  const card = await prisma.businessCard.findFirst({
    where: { id: cardId, ownerId: session.user.id, deletedAt: null },
    select: { id: true, slug: true, profileImageUrl: true, companyLogoUrl: true },
  });
  if (!card) return NextResponse.json({ error: "Card not found" }, { status: 404 });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const parsed = qrSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid QR settings" }, { status: 400 });

  const logoUrl = parsed.data.logoChoice === "company"
    ? card.companyLogoUrl
    : parsed.data.logoChoice === "profile" ? card.profileImageUrl : null;
  if (parsed.data.logoChoice !== "none" && !logoUrl) {
    return NextResponse.json({ error: "Upload the selected logo image first." }, { status: 400 });
  }

  await prisma.qRDesign.upsert({
    where: { businessCardId: card.id },
    update: {
      foregroundColor: parsed.data.foregroundColor,
      backgroundColor: parsed.data.backgroundColor,
      dotsType: parsed.data.dotsType,
      cornersSquareType: parsed.data.cornersSquareType,
      cornersDotType: parsed.data.cornersDotType,
      errorCorrectionLevel: parsed.data.errorCorrectionLevel,
      frameStyle: parsed.data.frameStyle,
      frameText: parsed.data.frameText || null,
      logoUrl,
    },
    create: {
      businessCardId: card.id,
      foregroundColor: parsed.data.foregroundColor,
      backgroundColor: parsed.data.backgroundColor,
      dotsType: parsed.data.dotsType,
      cornersSquareType: parsed.data.cornersSquareType,
      cornersDotType: parsed.data.cornersDotType,
      errorCorrectionLevel: parsed.data.errorCorrectionLevel,
      frameStyle: parsed.data.frameStyle,
      frameText: parsed.data.frameText || null,
      logoUrl,
    },
  });

  const response = NextResponse.json({ status: "saved" });
  response.headers.set("Cache-Control", "no-store");
  return response;
}
