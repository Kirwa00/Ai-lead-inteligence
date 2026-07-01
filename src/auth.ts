import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const { auth, handlers, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;

        // TODO: replace with DB lookup via Prisma once DATABASE_URL is set
        const DEMO_USERS = [
          { id: "1", email: "admin@a1intel.com", password: "demo1234", name: "Admin User", role: "admin" },
          { id: "2", email: "emmanuelkirwa8@gmail.com", password: "demo1234", name: "Emmanuel Kirwa", role: "admin" },
        ];

        const user = DEMO_USERS.find((u) => u.email === email && u.password === password);
        if (!user) return null;
        return { id: user.id, email: user.email, name: user.name, role: user.role };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) token.role = (user as { role?: string }).role;
      return token;
    },
    session({ session, token }) {
      if (session.user) (session.user as { role?: unknown }).role = token.role;
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: { strategy: "jwt" },
});
