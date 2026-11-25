/**
 * Pricing data. PLACEHOLDER numbers: edit freely, the page renders whatever is here.
 * Nothing in the app enforces these limits yet; this page is a preview of the plan structure.
 */
export type Audience = "individual" | "organisation";
export type Billing = "monthly" | "annual";
/** true = included, false = not included, string = included with this limit/description */
export type Cell = boolean | string;

export type Plan = {
  id: string;
  audience: Audience;
  name: string;
  tagline: string;
  /** KSh per month when billed monthly. null = "contact us" */
  monthly: number | null;
  popular?: boolean;
  cta: string;
  highlights: string[];
};

export type FeatureRow = {
  label: string;
  /** Not built yet: shown with a "Soon" badge so the page never over-promises. */
  soon?: boolean;
  /** One cell per plan of the audience, in plan order. */
  values: Cell[];
};

/** Annual billing = this many months paid per year (10 = "2 months free"). */
export const ANNUAL_MONTHS_PAID = 10;
export const SHOW_PREVIEW_NOTICE = true;
/** TODO: replace with your real sales address (or a contact page). */
export const ENTERPRISE_CONTACT = "mailto:hello@example.com?subject=vCard%20Platform%20Enterprise";

export const PLANS: Plan[] = [
  { id: "free", audience: "individual", name: "Free", tagline: "Try it and share your first card.", monthly: 0, cta: "Start free",
    highlights: ["1 digital card", "2 starter templates", "Save-to-contacts button", "Basic QR code"] },
  { id: "pro", audience: "individual", name: "Pro", tagline: "For professionals who network every week.", monthly: 450, popular: true, cta: "Choose Pro",
    highlights: ["3 digital cards", "All 8 templates", "Custom profile address", "Branded QR code with your logo", "Full analytics"] },
  { id: "executive", audience: "individual", name: "Executive", tagline: "Make a standout first impression.", monthly: 900, cta: "Choose Executive",
    highlights: ["10 digital cards", "Everything in Pro", "QR frames and call-to-action text", "Country and source insights", "Priority support"] },

  { id: "team", audience: "organisation", name: "Team", tagline: "Small teams that want matching cards.", monthly: 3000, cta: "Choose Team",
    highlights: ["Up to 10 team members", "Up to 10 cards", "Shared workspace with roles", "All 8 templates"] },
  { id: "business", audience: "organisation", name: "Business", tagline: "Growing companies with brand rules.", monthly: 9000, popular: true, cta: "Choose Business",
    highlights: ["Up to 50 team members", "Up to 50 cards", "Organisation-wide analytics", "Bulk import and brand-locked templates"] },
  { id: "enterprise", audience: "organisation", name: "Enterprise", tagline: "Large organisations and custom needs.", monthly: null, cta: "Talk to us",
    highlights: ["Unlimited members and cards", "Custom domain and SSO", "Custom card design and onboarding", "Dedicated account manager"] },
];

export const FEATURES: Record<Audience, FeatureRow[]> = {
  individual: [
    { label: "Digital business cards", values: ["1", "3", "10"] },
    { label: "Card templates", values: ["2 starter", "All 8", "All 8"] },
    { label: "Profile photo, cover image and company logo", values: ["Photo only", true, true] },
    { label: "Social links per card", values: ["3", "10", "15"] },
    { label: "Custom profile address (/p/your-name)", values: [false, true, true] },
    { label: "Save-to-contacts (.vcf) button", values: [true, true, true] },
    { label: "QR code with your colours and logo", values: [false, true, true] },
    { label: "QR frames and call-to-action text", values: [false, false, true] },
    { label: "Profile views, QR scans, saves and clicks", values: ["Views only", true, true] },
    { label: "Country and referrer breakdown", soon: true, values: [false, false, true] },
    { label: "Remove “Create yours free” footer", soon: true, values: [false, false, true] },
    { label: "Support", values: ["Help centre", "Email", "Priority"] },
  ],
  organisation: [
    { label: "Team members", values: ["Up to 10", "Up to 50", "Unlimited"] },
    { label: "Digital business cards", values: ["Up to 10", "Up to 50", "Unlimited"] },
    { label: "Shared workspace with Owner, Admin, Member and Viewer roles", values: [true, true, true] },
    { label: "All 8 card templates", values: [true, true, true] },
    { label: "Per-card analytics", values: [true, true, true] },
    { label: "Organisation-wide analytics", soon: true, values: [false, true, true] },
    { label: "Bulk card import from CSV", soon: true, values: [false, true, true] },
    { label: "Brand-locked templates", soon: true, values: [false, true, true] },
    { label: "Remove platform branding", soon: true, values: [false, true, true] },
    { label: "Custom domain", soon: true, values: [false, false, true] },
    { label: "Single sign-on (SSO)", soon: true, values: [false, false, true] },
    { label: "Custom card design and onboarding", values: [false, false, true] },
    { label: "Support", values: ["Email", "Priority email and WhatsApp", "Dedicated manager"] },
  ],
};

export function formatKsh(amount: number) {
  return "KSh " + amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** What to show for one plan under the chosen billing period. */
export function priceFor(plan: Plan, billing: Billing) {
  if (plan.monthly === null) return { main: "Custom", sub: "Tailored to your organisation", unit: "" };
  if (plan.monthly === 0) return { main: "KSh 0", sub: "Free forever", unit: "" };
  if (billing === "monthly") return { main: formatKsh(plan.monthly), unit: "/ month", sub: "Billed monthly" };
  const yearly = plan.monthly * ANNUAL_MONTHS_PAID;
  return {
    main: formatKsh(Math.round(yearly / 12)),
    unit: "/ month",
    sub: formatKsh(yearly) + " billed yearly · save " + formatKsh(plan.monthly * (12 - ANNUAL_MONTHS_PAID)),
  };
}
