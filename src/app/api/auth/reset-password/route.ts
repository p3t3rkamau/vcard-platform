import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth/password";
import { hashOneTimeToken } from "@/lib/auth/tokens";

export const runtime = "nodejs";

const schema = z.object({
  token: z.string().min(32).max(256),
  password: z.string().min(12).max(72),
});

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success || Buffer.byteLength(parsed.data?.password ?? "", "utf8") > 72) {
    return NextResponse.json(
      { error: "Password must be 12–72 characters and no more than 72 bytes." },
      { status: 400 },
    );
  }

  const tokenHash = hashOneTimeToken(parsed.data.token);
  const resetToken = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
  });

  if (!resetToken || resetToken.expiresAt <= new Date()) {
    if (resetToken) {
      await prisma.passwordResetToken.delete({ where: { id: resetToken.id } });
    }
    return NextResponse.json(
      { error: "This password reset link is invalid or has expired." },
      { status: 400 },
    );
  }

  const passwordHash = await hashPassword(parsed.data.password);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: resetToken.userId },
      data: { passwordHash },
    }),
    prisma.passwordResetToken.deleteMany({
      where: { userId: resetToken.userId },
    }),
  ]);

  return NextResponse.json({ message: "Password updated. You can now sign in." });
}
