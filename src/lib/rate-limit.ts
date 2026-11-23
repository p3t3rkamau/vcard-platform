import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";

/**
 * Fixed-window rate limiter backed by Postgres.
 * Accepts a Request (route handlers) or Headers (server actions, via `await headers()`).
 */
export async function checkRateLimit(
  source: Request | Headers,
  namespace: string,
  limit: number,
  windowMs: number,
  identity = "",
) {
  const requestHeaders = source instanceof Headers ? source : source.headers;
  const forwarded = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim();
  const address = forwarded || requestHeaders.get("x-real-ip") || "local";
  const key = createHash("sha256").update(namespace + ":" + address + ":" + identity).digest("hex");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + windowMs);

  const rows = await prisma.$queryRaw<Array<{ count: number }>>`
    INSERT INTO "rate_limit_buckets" ("key", "count", "windowStartedAt", "expiresAt")
    VALUES (${key}, 1, ${now}, ${expiresAt})
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE
        WHEN "rate_limit_buckets"."expiresAt" <= ${now} THEN 1
        ELSE "rate_limit_buckets"."count" + 1
      END,
      "windowStartedAt" = CASE
        WHEN "rate_limit_buckets"."expiresAt" <= ${now} THEN ${now}
        ELSE "rate_limit_buckets"."windowStartedAt"
      END,
      "expiresAt" = CASE
        WHEN "rate_limit_buckets"."expiresAt" <= ${now} THEN ${expiresAt}
        ELSE "rate_limit_buckets"."expiresAt"
      END
    RETURNING "count"
  `;

  // Expired buckets were never deleted, so the table grew forever. Clean up
  // opportunistically (about 1% of calls) instead of requiring a cron job.
  if (Math.random() < 0.01) {
    void prisma.rateLimitBucket
      .deleteMany({ where: { expiresAt: { lt: new Date(now.getTime() - 60 * 60 * 1000) } } })
      .catch(() => undefined);
  }

  return (rows[0]?.count ?? limit + 1) <= limit;
}
