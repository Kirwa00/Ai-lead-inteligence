import NextAuth, { type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import { authConfig } from "@/auth.config";
import { rateLimit } from "@/lib/rate-limit";
import { provisionSoloWorkspace } from "@/lib/provisioning";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

/** How long a JWT's cached role/org claims may go without a database re-read. */
const CLAIMS_TTL_MS = 5 * 60 * 1000;

/** Google is optional — the button only appears when both env vars are set. */
export function googleConfigured(): boolean {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

const providers: NextAuthConfig["providers"] = [
  Credentials({
    async authorize(credentials) {
      const parsed = loginSchema.safeParse(credentials);
      if (!parsed.success) return null;

      const { email, password } = parsed.data;

      // Brute-force throttle: cap sign-in attempts per email. Exceeding the
      // window is treated as a failed login (no info leak).
      const gate = rateLimit(`login:${email.toLowerCase()}`, 10, 15 * 60 * 1000);
      if (!gate.ok) return null;

      const user = await prisma.user.findUnique({
        where: { email },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          passwordHash: true,
          organizationId: true,
        },
      });

      if (!user?.passwordHash) return null;
      const valid = await verifyPassword(password, user.passwordHash);
      if (!valid) return null;

      return {
        id: user.id,
        email: user.email,
        name: user.name ?? undefined,
        role: user.role,
        organizationId: user.organizationId,
      };
    },
  }),
];

if (googleConfigured()) {
  providers.push(
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      allowDangerousEmailAccountLinking: true,
    })
  );
}

export const { auth, handlers, signIn, signOut } = NextAuth({
  ...authConfig,
  providers,
  callbacks: {
    ...authConfig.callbacks,

    /**
     * Google users have no row in our tables on first sign-in, and we run JWT
     * sessions with no database adapter — so provisioning happens here.
     * Returning false denies the sign-in.
     */
    async signIn({ user, account }) {
      if (account?.provider !== "google") return true;
      if (!user.email) return false;

      const email = user.email.toLowerCase();
      const existing = await prisma.user.findUnique({
        where: { email },
        select: { id: true, emailVerified: true },
      });

      if (existing) {
        // Google already proved ownership of the address, so trust it as
        // verification for an account that signed up with a password.
        if (!existing.emailVerified) {
          await prisma.user.update({
            where: { id: existing.id },
            data: { emailVerified: new Date(), image: user.image ?? undefined },
          });
        }
        return true;
      }

      await provisionSoloWorkspace({
        email,
        name: user.name ?? email.split("@")[0],
        image: user.image,
        emailVerified: new Date(),
      });
      return true;
    },

    /**
     * Credentials sign-in supplies role/organizationId directly; OAuth doesn't,
     * so backfill from the database by email.
     *
     * The claim is also re-read periodically so a role change (e.g. ownership
     * transfer) reaches the UI without forcing a re-login. This is a UX
     * refresh only — authorization never trusts this claim, see requireOwner().
     */
    async jwt({ token, user }) {
      if (user) {
        const u = user as { role?: string; organizationId?: string };
        if (u.role) token.role = u.role;
        if (u.organizationId) token.organizationId = u.organizationId;
      }

      const stale =
        typeof token.claimsRefreshedAt !== "number" ||
        Date.now() - token.claimsRefreshedAt > CLAIMS_TTL_MS;

      if ((!token.organizationId || stale) && token.email) {
        const dbUser = await prisma.user.findUnique({
          where: { email: token.email },
          select: { id: true, role: true, organizationId: true },
        });
        if (dbUser) {
          token.sub = dbUser.id;
          token.role = dbUser.role;
          token.organizationId = dbUser.organizationId;
        }
        token.claimsRefreshedAt = Date.now();
      }

      return token;
    },
  },
});
