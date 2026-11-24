import type { Metadata } from "next";
import { cache } from "react";
import { notFound, permanentRedirect } from "next/navigation";
import { headers } from "next/headers";
import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { countryFromHeaders, isBotUserAgent, referrerDomainFromHeaders, safeExternalUrl } from "@/lib/http";
import ProfileView from "./ProfileView";

type PageProps = { params: Promise<{ slug: string }>; searchParams: Promise<{ source?: string; reported?: string }> };

export const dynamic = "force-dynamic";

// React cache(): generateMetadata and the page share one query per request.
const getCard = cache(async function getCard(slug: string) {
  return prisma.businessCard.findFirst({
    where: { slug, status: "PUBLISHED", deletedAt: null },
    include: {
      contactMethods: { where: { isVisible: true }, orderBy: { sortOrder: "asc" } },
      socialLinks: { where: { isVisible: true }, orderBy: { sortOrder: "asc" } },
      template: true,
    },
  });
});

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const card = await getCard(slug);
  if (!card) return { title: "Profile not found" };

  const name = card.displayName || [card.firstName, card.lastName].filter(Boolean).join(" ") || "Digital business card";
  const description = card.bio || [card.jobTitle, card.companyName].filter(Boolean).join(" at ") || "Connect with " + name + ".";

  return {
    title: name,
    description,
    alternates: { canonical: "/p/" + card.slug },
    robots: { index: card.isSearchable, follow: true },
    openGraph: { title: name, description, url: "/p/" + card.slug, images: card.profileImageUrl ? [card.profileImageUrl] : [], type: "profile" },
    twitter: { card: card.profileImageUrl ? "summary_large_image" : "summary", title: name, description },
  };
}

export default async function PublicCardPage({ params, searchParams }: PageProps) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const card = await getCard(slug);

  if (!card) {
    const oldSlug = await prisma.slugRedirect.findUnique({ where: { oldSlug: slug }, select: { newSlug: true } });
    // README promises a *permanent* redirect for retired slugs; keep ?source=qr so printed QR codes still count as scans.
    if (oldSlug) permanentRedirect("/p/" + oldSlug.newSlug + (query.source === "qr" ? "?source=qr" : ""));
    notFound();
  }

  const name = card.displayName || [card.firstName, card.lastName].filter(Boolean).join(" ") || "Your name";
  const website = safeExternalUrl(card.website);
  const profileImage = safeExternalUrl(card.profileImageUrl);
  const templateSlug = card.template?.slug || "modern-corporate";
  const requestHeaders = await headers();
  const userAgent = requestHeaders.get("user-agent");

  if (!isBotUserAgent(userAgent)) {
    const eventTypes = query.source === "qr" ? (["PROFILE_VIEW", "QR_SCAN"] as const) : (["PROFILE_VIEW"] as const);
    const countryCode = countryFromHeaders(requestHeaders);
    const referrerDomain = referrerDomainFromHeaders(requestHeaders);
    // after(): the analytics write no longer delays the page the visitor is waiting for.
    after(async () => {
      await prisma.analyticsEvent
        .createMany({ data: eventTypes.map((eventType) => ({ businessCardId: card.id, eventType, countryCode, referrerDomain })) })
        .catch(() => undefined);
    });
  }

  const jsonLd = card.isSearchable ? {
    "@context": "https://schema.org",
    "@type": "Person",
    name,
    ...(card.jobTitle ? { jobTitle: card.jobTitle } : {}),
    ...(card.companyName ? { worksFor: { "@type": "Organization", name: card.companyName } } : {}),
    ...(profileImage ? { image: profileImage } : {}),
    ...(website ? { url: website } : {}),
  } : null;

  return <ProfileView card={card} templateSlug={templateSlug} reported={query.reported === "1"} jsonLd={jsonLd} />;
}
