// One-off: give any workspace still at $0 a starter value grant, so existing
// accounts aren't stuck behind the wallet gate after metering went live.
// Run: npx dotenv -e .env -- node scripts/backfill-credits.js
const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const GRANT_MICROS = 5_000_000n; // $5.00 of service value (~$0.71 raw tokens)

async function main() {
  const orgs = await prisma.organization.findMany({
    where: { creditBalanceMicros: 0n },
    select: { id: true, name: true },
  });

  for (const o of orgs) {
    await prisma.$transaction(async (tx) => {
      const updated = await tx.organization.update({
        where: { id: o.id },
        data: { creditBalanceMicros: { increment: GRANT_MICROS } },
        select: { creditBalanceMicros: true },
      });
      await tx.walletTransaction.create({
        data: {
          organizationId: o.id,
          type: "grant",
          amountMicros: GRANT_MICROS,
          balanceAfterMicros: updated.creditBalanceMicros,
          description: "Backfill starter credits",
        },
      });
    });
    console.log(`✓ granted $5.00 → ${o.name}`);
  }

  console.log(`Done. ${orgs.length} workspace(s) backfilled.`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
