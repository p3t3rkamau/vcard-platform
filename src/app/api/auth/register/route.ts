import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth/password";
import { createOneTimeToken } from "@/lib/auth/tokens";
import { isEmailDeliveryConfigured, sendVerificationEmail } from "@/lib/email";

export const runtime = "nodejs";

const registerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(254),
  password: z.string().min(12).max(72),
});

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = registerSchema.safeParse(body);
  if (!parsed.success || Buffer.byteLength(parsed.data?.password ?? "", "utf8") > 72) {
    return NextResponse.json(
      { error: "Enter a valid name and email. Passwords must be 12–72 characters and no more than 72 bytes." },
      { status: 400 },
    );
  }

  if (!isEmailDeliveryConfigured()) {
    return NextResponse.json(
      { error: "Email delivery is not configured yet. Configure SMTP before registering users." },
      { status: 503 },
    );
  }

  const email = parsed.data.email.toLowerCase();
  const existingUser = await prisma.user.findUnique({ where: { email } });

  if (existingUser) {
    return NextResponse.json(
      { error: "An account with this email already exists. Try signing in or resetting your password." },
      { status: 409 },
    );
  }

  const passwordHash = await hashPassword(parsed.data.password);
  const { token, tokenHash } = createOneTimeToken();

  try {
    const user = await prisma.user.create({
      data: {
        name: parsed.data.name,
        email,
        passwordHash,
        emailVerificationTokens: {
          create: {
            tokenHash,
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          },
        },
      },
    });

    try {
      await sendVerificationEmail(email, token);
    } catch (error) {
      await prisma.user.delete({ where: { id: user.id } });
      console.error("Verification email delivery failed:", error);
      return NextResponse.json(
        { error: "We couldn't send the verification email. Check SMTP settings and try again." },
        { status: 503 },
      );
    }

    return NextResponse.json(
      { message: "Account created. Check your inbox to verify your email before signing in." },
      { status: 201 },
    );
  } catch (error) {
    console.error("Registration failed:", error);
    return NextResponse.json({ error: "Unable to create your account." }, { status: 500 });
  }
}
