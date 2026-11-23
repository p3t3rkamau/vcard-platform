import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { countryFromHeaders, isBotUserAgent, referrerDomainFromHeaders, safeExternalUrl } from "@/lib/http";

type RouteProps = { params: Promise<{ cardId: string; linkId: string }> };

// NOTE: despite the folder name, `cardId` is the public *slug*.
export async function GET(request: Request, { params }: RouteProps) {
  const { cardId: slug, linkId } = await params;
  const card = await prisma.businessCard.findFirst({
    where: { slug, status: "PUBLISHED", deletedAt: null },
    select: { id: true, website: true },
  });
  if (!card) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  let destination: string | null = null;
  let eventType: "WEBSITE_CLICK" | "SOCIAL_CLICK" = "WEBSITE_CLICK";

  if (linkId === "website") {
    destination = safeExternalUrl(card.website);
  } else {
    const [contact, social] = await Promise.all([
      prisma.contactMethod.findFirst({ where: { id: linkId, businessCardId: card.id, isVisible: true, type: "WEBSITE" }, select: { value: true } }),
      prisma.socialLink.findFirst({ where: { id: linkId, businessCardId: card.id, isVisible: true }, select: { url: true } }),
    ]);
    destination = safeExternalUrl(contact?.value ?? social?.url);
    if (!contact && social) eventType = "SOCIAL_CLICK";
  }

  if (!destination) return NextResponse.json({ error: "Link not found" }, { status: 404 });

  if (!isBotUserAgent(request.headers.get("user-agent"))) {
    await prisma.analyticsEvent
      .create({
        data: {
          businessCardId: card.id,
          eventType,
          countryCode: countryFromHeaders(request.headers),
          referrerDomain: referrerDomainFromHeaders(request.headers),
        },
      })
      .catch(() => undefined);
  }

  return NextResponse.redirect(destination, 302);
}
