import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createOneTimeToken } from "@/lib/auth/tokens";
import { isEmailDeliveryConfigured, sendPasswordResetEmail } from "@/lib/email";

export const runtime = "nodejs";

const schema = z.object({
  email: z.string().trim().email().max(254),
});

const genericResponse = {
  message: "If an eligible account exists, password reset instructions will be sent to its email address.",
};

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email.toLowerCase() },
  });

  if (!user?.emailVerified || !user.passwordHash || !isEmailDeliveryConfigured()) {
    return NextResponse.json(genericResponse);
  }

  const { token, tokenHash } = createOneTimeToken();

  await prisma.$transaction([
    prisma.passwordResetToken.deleteMany({ where: { userId: user.id } }),
    prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      },
    }),
  ]);

  try {
    await sendPasswordResetEmail(user.email!, token);
  } catch (error) {
    await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });
    console.error("Password reset email delivery failed:", error);
    return NextResponse.json(
      { error: "We couldn't send the reset email. Please try again later." },
      { status: 503 },
    );
  }

  return NextResponse.json(genericResponse);
}
