import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";

export const revalidate = 3600;

// Only profiles whose owners opted in to search indexing are listed.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
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
    ...cards.map((card) => ({ url: base + "/p/" + card.slug, lastModified: card.updatedAt, changeFrequency: "monthly" as const, priority: 0.6 })),
  ];
}
