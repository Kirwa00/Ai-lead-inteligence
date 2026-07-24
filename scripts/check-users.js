// Read-only: list users (email/role/org). Passwords are hashed — not shown.
// Run: npx dotenv -e .env -- node scripts/check-users.js
const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

(async () => {
  const users = await prisma.user.findMany({
    select: {
      email: true, role: true, passwordHash: true,
      organization: { select: { name: true, creditBalanceMicros: true } },
    },
    orderBy: { createdAt: "asc" },
  });
  for (const u of users) {
    const bal = Number(u.organization?.creditBalanceMicros ?? 0) / 1e6;
    console.log(`${u.email} | role=${u.role} | pw=${u.passwordHash ? "set" : "MISSING"} | org=${u.organization?.name} ($${bal})`);
  }
  await prisma.$disconnect();
})().catch((e) => { console.error(e.message); process.exit(1); });
