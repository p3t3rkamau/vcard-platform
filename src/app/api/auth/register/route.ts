import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth/password";
import { createOneTimeToken } from "@/lib/auth/tokens";
import { isEmailDeliveryConfigured, sendAccountExistsEmail, sendVerificationEmail } from "@/lib/email";
import { checkRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

// Identical for new and existing emails so the endpoint cannot be used to discover who has an account.
const CHECK_INBOX_MESSAGE = "Almost there. Check your inbox for an email from us to finish setting up your account.";

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

  const email = parsed.data.email.toLowerCase();
  const developmentVerificationBypass = process.env.NODE_ENV !== "production" && process.env.ALLOW_UNVERIFIED_LOGIN === "true";
  if (!(await checkRateLimit(request, "register-global", 12, 60 * 60 * 1000)) || !(await checkRateLimit(request, "register", 5, 15 * 60 * 1000, email))) {
    return NextResponse.json({ error: "Too many registration attempts. Please try again later." }, { status: 429 });
  }
  if (!isEmailDeliveryConfigured() && !developmentVerificationBypass) {
    return NextResponse.json(
      { error: "Email delivery is not configured yet. Configure SMTP before registering users." },
      { status: 503 },
    );
  }
  // Hash before the lookup so new and existing emails take a similar amount of time.
  const passwordHash = await hashPassword(parsed.data.password);
  const existingUser = await prisma.user.findUnique({ where: { email } });

  if (existingUser) {
    // Local development only: be explicit, since enumeration is not a concern there.
    if (developmentVerificationBypass) {
      return NextResponse.json({ error: "An account with this email already exists. Try signing in." }, { status: 409 });
    }

    try {
      if (!existingUser.emailVerified) {
        // Previously this was a dead end: an unverified user whose 24h link expired could not
        // sign in, could not reset their password (requires verified email) and could not re-register.
        const resend = createOneTimeToken();
        await prisma.$transaction([
          prisma.emailVerificationToken.deleteMany({ where: { userId: existingUser.id } }),
          prisma.emailVerificationToken.create({
            data: { userId: existingUser.id, tokenHash: resend.tokenHash, expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) },
          }),
        ]);
        await sendVerificationEmail(email, resend.token);
      } else {
        await sendAccountExistsEmail(email);
      }
    } catch (error) {
      console.error("Registration follow-up email failed:", error);
    }
    return NextResponse.json({ message: CHECK_INBOX_MESSAGE }, { status: 201 });
  }

  const { token, tokenHash } = createOneTimeToken();

  try {
    const user = await prisma.user.create({
      data: {
        name: parsed.data.name,
        email,
        passwordHash,
        ...(developmentVerificationBypass ? { emailVerified: new Date() } : {
          emailVerificationTokens: {
            create: {
              tokenHash,
              expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
            },
          },
        }),
      },
    });

    if (!developmentVerificationBypass) {
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
    }

    return NextResponse.json(
      { message: developmentVerificationBypass ? "Account created. You can sign in in this development environment." : CHECK_INBOX_MESSAGE },
      { status: 201 },
    );
  } catch (error) {
    console.error("Registration failed:", error);
    return NextResponse.json({ error: "Unable to create your account." }, { status: 500 });
  }
}
