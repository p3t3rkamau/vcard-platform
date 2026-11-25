import { NextResponse } from "next/server";
import { del, put } from "@vercel/blob";
import { auth } from "@/auth";
import { isAdminEmail } from "@/lib/admin";
import { classifyBlobError, configuredBlobVariables, getBlobConfig, storeIdFromToken } from "@/lib/blob";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Admin-only diagnostic: open /api/admin/blob-check while signed in as an admin.
 * It reports which environment variable the app uses and whether a tiny PUBLIC test upload works.
 * It never returns the token itself.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id || !isAdminEmail(session.user.email)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const config = getBlobConfig();
  const report: Record<string, unknown> = {
    variablesSet: configuredBlobVariables(),
    usedVariable: config?.source ?? null,
    storeId: config ? storeIdFromToken(config.token) : null,
  };
  if (!config) {
    return NextResponse.json({ ...report, ok: false, problem: "No Blob token variable is set for this environment." }, { headers: { "Cache-Control": "no-store" } });
  }

  try {
    const blob = await put("diagnostics/blob-check.txt", "ok", { access: "public", token: config.token, addRandomSuffix: true, contentType: "text/plain" });
    await del(blob.url, { token: config.token }).catch(() => undefined);
    return NextResponse.json({ ...report, ok: true, result: "A public test upload worked and was removed again." }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json(
      { ...report, ok: false, failure: classifyBlobError(error), errorType: error instanceof Error ? error.constructor.name : "unknown", message: error instanceof Error ? error.message : String(error) },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  }
}
