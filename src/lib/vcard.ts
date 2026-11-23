import { safeExternalUrl } from "@/lib/http";

export type VCardSource = {
  publicId: string;
  updatedAt: Date;
  displayName: string | null;
  firstName: string | null;
  lastName: string | null;
  jobTitle: string | null;
  companyName: string | null;
  bio: string | null;
  website: string | null;
  address: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  profileImageUrl: string | null;
  contactMethods: Array<{ type: string; value: string }>;
};

/** Escapes a vCard 3.0 TEXT value (RFC 2426 §5). Not for URI values. */
export function escapeVCardText(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\r\n|\r|\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

/** Folds a content line at 75 octets without splitting multi-byte characters. */
export function foldLine(line: string) {
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

export function buildVCard(card: VCardSource) {
  const nameParts = (card.displayName || "").trim().split(/\s+/).filter(Boolean);
  const firstName = card.firstName || nameParts[0] || "";
  const lastName = card.lastName || nameParts.slice(1).join(" ") || "";
  const fullName = card.displayName || [firstName, lastName].filter(Boolean).join(" ") || "Contact";

  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    // A stable UID lets phones update the existing contact on re-import instead of duplicating it.
    "UID:urn:uuid:" + card.publicId,
    "REV:" + card.updatedAt.toISOString().replace(/\.\d{3}Z$/, "Z"),
    "N:" + escapeVCardText(lastName) + ";" + escapeVCardText(firstName) + ";;;",
    "FN:" + escapeVCardText(fullName),
  ];

  if (card.companyName) lines.push("ORG:" + escapeVCardText(card.companyName));
  if (card.jobTitle) lines.push("TITLE:" + escapeVCardText(card.jobTitle));

  const seenUrls = new Set<string>();
  const pushUrl = (raw: string | null | undefined) => {
    // URI values are not TEXT: escaping "," or ";" would corrupt the link.
    const url = safeExternalUrl(raw);
    if (!url || seenUrls.has(url)) return;
    seenUrls.add(url);
    lines.push("URL:" + url);
  };

  for (const method of card.contactMethods) {
    if (method.type === "PHONE" || method.type === "WHATSAPP") lines.push("TEL;TYPE=CELL,VOICE:" + escapeVCardText(method.value));
    else if (method.type === "EMAIL") lines.push("EMAIL;TYPE=INTERNET,WORK:" + escapeVCardText(method.value));
    else if (method.type === "WEBSITE") pushUrl(method.value);
    else if (method.type === "ADDRESS") lines.push("ADR;TYPE=WORK:;;" + escapeVCardText(method.value) + ";;;;");
  }

  pushUrl(card.website);

  if (card.address || card.city || card.region || card.country) {
    const [street, city, region, country] = [card.address, card.city, card.region, card.country].map((part) => escapeVCardText(part || ""));
    lines.push("ADR;TYPE=WORK:;;" + street + ";" + city + ";" + region + ";;" + country);
  }

  const photo = safeExternalUrl(card.profileImageUrl);
  if (photo) lines.push("PHOTO;VALUE=URI:" + photo);
  if (card.bio) lines.push("NOTE:" + escapeVCardText(card.bio));
  lines.push("END:VCARD");

  return lines.map(foldLine).join("\r\n") + "\r\n";
}

export function vCardFilename(slug: string) {
  return (slug.replace(/[^a-z0-9-]/gi, "-").slice(0, 60) || "contact") + ".vcf";
}
