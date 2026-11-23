import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { compare } from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";

// Compared against when the email is unknown, so "no such user" costs the same as "wrong password".
const DUMMY_PASSWORD_HASH = "$2b$12$Xww.vB.mkn1S4Kl5n1ZvOew3gCdIoXlhzCDra0S9rX/B3kG3E4Oaq";

const credentialsSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(128),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  // Vercel provides trusted forwarded host headers; use the request host for Auth.js URLs.
  trustHost: true,
  adapter: PrismaAdapter(prisma),
  providers: [
    Credentials({
      name: "Email and password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, request) {
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const email = parsed.data.email.toLowerCase();
        if (!(await checkRateLimit(request, "login", 10, 15 * 60 * 1000, email))) return null;
        const user = await prisma.user.findUnique({ where: { email } });

        const developmentVerificationBypass = process.env.NODE_ENV !== "production" && process.env.ALLOW_UNVERIFIED_LOGIN === "true";
        const passwordIsValid = await compare(parsed.data.password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);
        if (!user?.passwordHash || !passwordIsValid) return null;
        if (!user.emailVerified && !developmentVerificationBypass) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        };
      },
    }),
  ],
  session: {
    // Auth.js Credentials provider requires JWT sessions.
    strategy: "jwt",
    maxAge: 60 * 60 * 24 * 30,
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.sub = user.id;
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) session.user.id = token.sub;
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
});
