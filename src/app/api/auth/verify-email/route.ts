import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashOneTimeToken } from "@/lib/auth/tokens";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");

  if (!token || token.length > 256) {
    return NextResponse.redirect(new URL("/login?verified=invalid", url.origin));
  }

  const tokenHash = hashOneTimeToken(token);
  const record = await prisma.emailVerificationToken.findUnique({
    where: { tokenHash },
  });

  if (!record || record.expiresAt <= new Date()) {
    if (record) {
      await prisma.emailVerificationToken.delete({ where: { id: record.id } });
    }
    return NextResponse.redirect(new URL("/login?verified=expired", url.origin));
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: { emailVerified: new Date() },
    }),
    prisma.emailVerificationToken.delete({ where: { id: record.id } }),
  ]);

  return NextResponse.redirect(new URL("/login?verified=success", url.origin));
}
