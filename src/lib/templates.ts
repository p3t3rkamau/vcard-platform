export const CARD_TEMPLATES = [
  { slug: "modern-corporate", name: "Modern Corporate", description: "A crisp, confident layout for business professionals.", category: "Professional", sortOrder: 1 },
  { slug: "minimal-professional", name: "Minimal Professional", description: "Clean typography and generous whitespace.", category: "Minimal", sortOrder: 2 },
  { slug: "executive-dark", name: "Executive Dark", description: "A premium dark presentation with refined contrast.", category: "Premium", sortOrder: 3 },
  { slug: "creative-portfolio", name: "Creative Portfolio", description: "Expressive styling for designers and creators.", category: "Creative", sortOrder: 4 },
  { slug: "elegant-business", name: "Elegant Business", description: "A calm, editorial look with classic typography.", category: "Elegant", sortOrder: 5 },
  { slug: "gradient-modern", name: "Gradient Modern", description: "A bold contemporary profile with a vivid header.", category: "Modern", sortOrder: 6 },
  { slug: "personal-branding", name: "Personal Branding", description: "A personality-first profile with a strong identity.", category: "Personal", sortOrder: 7 },
  { slug: "luxury-corporate", name: "Luxury Corporate", description: "Understated premium styling for senior professionals.", category: "Premium", sortOrder: 8 },
] as const;

export type CardTemplateSlug = (typeof CARD_TEMPLATES)[number]["slug"];

export async function ensureDefaultTemplates() {
  const { prisma } = await import("@/lib/prisma");

  // This ran 8 upserts (8 writes) on every edit-page view. One cheap count avoids that
  // once the templates exist.
  const existing = await prisma.template.count({
    where: { slug: { in: CARD_TEMPLATES.map((template) => template.slug) }, isActive: true },
  });
  if (existing >= CARD_TEMPLATES.length) return;

  await Promise.all(CARD_TEMPLATES.map((template) =>
    prisma.template.upsert({
      where: { slug: template.slug },
      update: {
        name: template.name,
        description: template.description,
        category: template.category,
        sortOrder: template.sortOrder,
        isActive: true,
      },
      create: {
        slug: template.slug,
        name: template.name,
        description: template.description,
        category: template.category,
        sortOrder: template.sortOrder,
        isActive: true,
      },
    }),
  ));
}
