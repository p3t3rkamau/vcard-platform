import type { MetadataRoute } from "next";
import { appBaseUrl } from "@/lib/http";

export default function robots(): MetadataRoute.Robots {
  const base = appBaseUrl();
  return {
    rules: [{ userAgent: "*", allow: ["/", "/p/"], disallow: ["/dashboard", "/api/", "/login", "/register", "/forgot-password", "/reset-password"] }],
    sitemap: base + "/sitemap.xml",
  };
}
