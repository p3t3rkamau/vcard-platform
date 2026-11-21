import { prisma } from "@/lib/prisma";

type RouteProps = { params: Promise<{ cardId: string }> };

function escapeVCardText(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\r\n|\r|\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function foldLine(line: string) {
  const parts: string[] = [];
  let current = "";
  let bytes = 0;
  for (const character of line) {
    const size = Buffer.byteLength(character, "utf8");
    if (bytes + size > 75) {
      parts.push(current);
      current = " " + character;
      bytes = 1 + size;
    } else {
      current += character;
      bytes += size;
    }
  }
  parts.push(current);
  return parts.join("\r\n");
}

function safeFilename(slug: string) {
  return slug.replace(/[^a-z0-9-]/gi, "-").slice(0, 60) || "contact";
}

export async function GET(_request: Request, { params }: RouteProps) {
  const { cardId: slug } = await params;
  const card = await prisma.businessCard.findFirst({
    where: { slug, status: "PUBLISHED", deletedAt: null },
    include: {
      contactMethods: { where: { isVisible: true }, orderBy: { sortOrder: "asc" } },
    },
  });
  if (!card) return Response.json({ error: "Profile not found" }, { status: 404 });

  await prisma.analyticsEvent.create({ data: { businessCardId: card.id, eventType: "CONTACT_SAVE" } }).catch(() => undefined);

  const nameParts = (card.displayName || "").trim().split(/\s+/).filter(Boolean);
  const firstName = card.firstName || nameParts[0] || "";
  const lastName = card.lastName || nameParts.slice(1).join(" ") || "";
  const fullName = card.displayName || [firstName, lastName].filter(Boolean).join(" ");
  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    "N:" + escapeVCardText(lastName) + ";" + escapeVCardText(firstName) + ";;;",
    "FN:" + escapeVCardText(fullName),
  ];

  if (card.companyName) lines.push("ORG:" + escapeVCardText(card.companyName));
  if (card.jobTitle) lines.push("TITLE:" + escapeVCardText(card.jobTitle));

  for (const method of card.contactMethods) {
    const value = escapeVCardText(method.value);
    if (method.type === "PHONE" || method.type === "WHATSAPP") lines.push("TEL;TYPE=CELL,VOICE:" + value);
    else if (method.type === "EMAIL") lines.push("EMAIL;TYPE=INTERNET,WORK:" + value);
    else if (method.type === "WEBSITE") lines.push("URL:" + value);
    else if (method.type === "ADDRESS") lines.push("ADR;TYPE=WORK:;;" + value + ";;;;");
  }

  if (card.website) lines.push("URL:" + escapeVCardText(card.website));
  if (card.address || card.city || card.region || card.country) {
    const address = [card.address, card.city, card.region, card.country].map((part) => escapeVCardText(part || ""));
    lines.push("ADR;TYPE=WORK:;;" + address[0] + ";" + address[1] + ";" + address[2] + ";;" + address[3]);
  }
  if (card.profileImageUrl) lines.push("PHOTO;VALUE=URI:" + escapeVCardText(card.profileImageUrl));
  if (card.bio) lines.push("NOTE:" + escapeVCardText(card.bio));
  lines.push("END:VCARD");

  const body = lines.map(foldLine).join("\r\n") + "\r\n";
  return new Response(body, {
    headers: {
      "Content-Type": "text/vcard; charset=utf-8",
      "Content-Disposition": 'attachment; filename="' + safeFilename(card.slug) + '.vcf"',
      "Cache-Control": "private, no-store",
    },
  });
}
