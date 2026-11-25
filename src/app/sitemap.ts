import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { appBaseUrl } from "@/lib/http";

export const revalidate = 3600;

// Only profiles whose owners opted in to search indexing are listed.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = appBaseUrl();
  const cards = await prisma.businessCard
    .findMany({
      where: { status: "PUBLISHED", isSearchable: true, deletedAt: null },
      select: { slug: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
      take: 5000,
    })
    .catch(() => []);

  return [
    { url: base, changeFrequency: "monthly", priority: 1 },
    { url: base + "/pricing", changeFrequency: "monthly", priority: 0.8 },
    ...cards.map((card) => ({ url: base + "/p/" + card.slug, lastModified: card.updatedAt, changeFrequency: "monthly" as const, priority: 0.6 })),
  ];
}
