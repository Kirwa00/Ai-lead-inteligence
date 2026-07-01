import type { NextAuthConfig } from "next-auth";

// Edge-safe auth config — no Node.js crypto/pg imports
export const authConfig: NextAuthConfig = {
  providers: [],
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const { pathname } = nextUrl;
      const isPublic = pathname.startsWith("/login") || pathname.startsWith("/api/auth");
      if (!isLoggedIn && !isPublic) return false;
      return true;
    },
    jwt({ token, user }) {
      if (user) {
        const u = user as { role?: string; organizationId?: string };
        token.role = u.role;
        token.organizationId = u.organizationId;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        const u = session.user as { role?: unknown; organizationId?: unknown };
        u.role = token.role;
        u.organizationId = token.organizationId;
      }
      return session;
    },
  },
};
