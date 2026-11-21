import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";

export async function checkRateLimit(
  request: Request,
  namespace: string,
  limit: number,
  windowMs: number,
  identity = "",
) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const address = forwarded || request.headers.get("x-real-ip") || "local";
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

  return (rows[0]?.count ?? limit + 1) <= limit;
}
