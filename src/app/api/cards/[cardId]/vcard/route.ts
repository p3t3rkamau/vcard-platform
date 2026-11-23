import { prisma } from "@/lib/prisma";
import { buildVCard, vCardFilename } from "@/lib/vcard";
import { isBotUserAgent } from "@/lib/http";

type RouteProps = { params: Promise<{ cardId: string }> };

// NOTE: despite the folder name, this segment is the public *slug*.
export async function GET(request: Request, { params }: RouteProps) {
  const { cardId: slug } = await params;
  const card = await prisma.businessCard.findFirst({
    where: { slug, status: "PUBLISHED", deletedAt: null },
    include: {
      contactMethods: { where: { isVisible: true }, orderBy: { sortOrder: "asc" } },
    },
  });
  if (!card) return Response.json({ error: "Profile not found" }, { status: 404 });

  // Link-preview bots and crawlers also fetch this URL; don't count them as saves.
  if (!isBotUserAgent(request.headers.get("user-agent"))) {
    await prisma.analyticsEvent
      .create({ data: { businessCardId: card.id, eventType: "CONTACT_SAVE" } })
      .catch(() => undefined);
  }

  return new Response(buildVCard(card), {
    headers: {
      "Content-Type": "text/vcard; charset=utf-8",
      "Content-Disposition": 'attachment; filename="' + vCardFilename(card.slug) + '"',
      "Cache-Control": "private, no-store",
    },
  });
}
