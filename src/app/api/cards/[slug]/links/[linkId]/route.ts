import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

type RouteProps = { params: Promise<{ slug: string; linkId: string }> };

function safeUrl(value: string) {
  try {
    const url = new URL(/^https?:\/\//i.test(value) ? value : "https://" + value);
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : null;
  } catch { return null; }
}

export async function GET(request: Request, { params }: RouteProps) {
  const { slug, linkId } = await params;
  const card = await prisma.businessCard.findFirst({
    where: { slug, status: "PUBLISHED", deletedAt: null },
    select: { id: true },
  });
  if (!card) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  const [contact, social] = await Promise.all([
    prisma.contactMethod.findFirst({ where: { id: linkId, businessCardId: card.id, isVisible: true, type: "WEBSITE" }, select: { value: true } }),
    prisma.socialLink.findFirst({ where: { id: linkId, businessCardId: card.id, isVisible: true }, select: { url: true } }),
  ]);
  const destination = contact ? safeUrl(contact.value) : social ? safeUrl(social.url) : null;
  if (!destination) return NextResponse.json({ error: "Link not found" }, { status: 404 });

  const userAgent = request.headers.get("user-agent") || "";
  if (!/bot|crawler|spider|preview/i.test(userAgent)) {
    const countryHeader = request.headers.get("x-vercel-ip-country");
    const countryCode = countryHeader && /^[A-Z]{2}$/.test(countryHeader) ? countryHeader : null;
    const referrer = request.headers.get("referer");
    let referrerDomain: string | null = null;
    try { referrerDomain = referrer ? new URL(referrer).hostname.slice(0, 190) : null; } catch { referrerDomain = null; }
    await prisma.analyticsEvent.create({
      data: { businessCardId: card.id, eventType: contact ? "WEBSITE_CLICK" : "SOCIAL_CLICK", countryCode, referrerDomain },
    }).catch(() => undefined);
  }

  return NextResponse.redirect(destination, 302);
}
