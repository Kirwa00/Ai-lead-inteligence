// @ts-check
const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const { scrypt, randomBytes } = require("crypto");
const { promisify } = require("util");

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });
const scryptAsync = promisify(scrypt);

async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const buf = await scryptAsync(password, salt, 64);
  return `${buf.toString("hex")}.${salt}`;
}

async function main() {
  const existing = await prisma.organization.count();
  if (existing > 0) {
    console.log("✓ Already seeded — skipping.");
    return;
  }

  console.log("Seeding database…");

  // ── Organisation ─────────────────────────────────────────────────
  const org = await prisma.organization.create({
    data: { name: "Enterprise Global", slug: "enterprise-global", plan: "pro" },
  });

  // ── Users ─────────────────────────────────────────────────────────
  const passwordHash = await hashPassword("demo1234");

  await prisma.user.createMany({
    data: [
      { email: "admin@a1intel.com",        name: "Admin User",      role: "admin", passwordHash, organizationId: org.id },
      { email: "emmanuelkirwa8@gmail.com", name: "Emmanuel Kirwa",  role: "admin", passwordHash, organizationId: org.id },
    ],
  });

  // ── Campaigns ─────────────────────────────────────────────────────
  const [c1, c2, c3, c4, c5, c6] = await Promise.all([
    prisma.campaign.create({ data: { name: "Kenya FinTech Outreach Q3", status: "active",    industry: "FinTech",     geography: "Kenya",       organizationId: org.id } }),
    prisma.campaign.create({ data: { name: "East Africa SaaS CEOs",     status: "active",    industry: "SaaS",        geography: "East Africa", organizationId: org.id } }),
    prisma.campaign.create({ data: { name: "Nairobi Real Estate Q3",    status: "paused",    industry: "Real Estate", geography: "Nairobi",     organizationId: org.id } }),
    prisma.campaign.create({ data: { name: "Pan-Africa Healthcare",      status: "active",    industry: "Healthcare",  geography: "Pan-Africa",  organizationId: org.id } }),
    prisma.campaign.create({ data: { name: "Logistics & Supply Chain",   status: "validating",industry: "Logistics",   geography: "Kenya",       organizationId: org.id } }),
    prisma.campaign.create({ data: { name: "EdTech East Africa",         status: "draft",     industry: "EdTech",      geography: "East Africa", organizationId: org.id } }),
  ]);

  // ── Companies ─────────────────────────────────────────────────────
  const [co1, co2, co3, co4, co5, co6, co7, co8] = await Promise.all([
    prisma.company.create({ data: { name: "Safaricom PLC",    domain: "safaricom.co.ke",  industry: "Telecom",  country: "Kenya",  city: "Nairobi",  size: "5000+" } }),
    prisma.company.create({ data: { name: "Equity Bank Kenya",domain: "equitybank.co.ke", industry: "Banking",  country: "Kenya",  city: "Nairobi",  size: "5000+" } }),
    prisma.company.create({ data: { name: "KPLC",             domain: "kplc.co.ke",       industry: "Energy",   country: "Kenya",  city: "Nairobi",  size: "1000-5000" } }),
    prisma.company.create({ data: { name: "Twiga Foods",      domain: "twiga.com",        industry: "AgriTech", country: "Kenya",  city: "Nairobi",  size: "201-1000" } }),
    prisma.company.create({ data: { name: "M-KOPA Solar",     domain: "m-kopa.com",       industry: "CleanTech",country: "Kenya",  city: "Nairobi",  size: "201-1000" } }),
    prisma.company.create({ data: { name: "Pezesha Africa",   domain: "pezesha.com",      industry: "FinTech",  country: "Kenya",  city: "Nairobi",  size: "51-200" } }),
    prisma.company.create({ data: { name: "Sendy Ltd",        domain: "sendy.co.ke",      industry: "Logistics",country: "Kenya",  city: "Nairobi",  size: "51-200" } }),
    prisma.company.create({ data: { name: "Farmshine",        domain: "farmshine.africa", industry: "AgriTech", country: "Kenya",  city: "Nairobi",  size: "11-50" } }),
  ]);

  // ── Contacts ──────────────────────────────────────────────────────
  const [ct1, ct2, ct3, ct4, ct5, ct6, ct7, ct8] = await Promise.all([
    prisma.contact.create({ data: { firstName: "Peter",   lastName: "Ndegwa",    title: "CEO",        email: "p.ndegwa@safaricom.co.ke",  companyId: co1.id } }),
    prisma.contact.create({ data: { firstName: "James",   lastName: "Mwangi",    title: "Group MD",   email: "j.mwangi@equitybank.co.ke", companyId: co2.id } }),
    prisma.contact.create({ data: { firstName: "Rosemary",lastName: "Oduor",     title: "CEO",        email: "r.oduor@kplc.co.ke",        companyId: co3.id } }),
    prisma.contact.create({ data: { firstName: "Grant",   lastName: "Brooke",    title: "Co-Founder", email: "grant@twiga.com",            companyId: co4.id } }),
    prisma.contact.create({ data: { firstName: "Maarten", lastName: "Sprenger",  title: "CFO",        email: "m.sprenger@m-kopa.com",      companyId: co5.id } }),
    prisma.contact.create({ data: { firstName: "Hilda",   lastName: "Moraa",     title: "CEO",        email: "hilda@pezesha.com",          companyId: co6.id } }),
    prisma.contact.create({ data: { firstName: "Meshack", lastName: "Alloys",    title: "CTO",        email: "m.alloys@sendy.co.ke",       companyId: co7.id } }),
    prisma.contact.create({ data: { firstName: "Alice",   lastName: "Kamau",     title: "COO",        email: "alice@farmshine.africa",     companyId: co8.id } }),
  ]);

  // ── Leads ─────────────────────────────────────────────────────────
  await prisma.lead.createMany({
    data: [
      { score: 94, status: "qualified",   campaignId: c1.id, companyId: co1.id, contactId: ct1.id },
      { score: 91, status: "contacted",   campaignId: c1.id, companyId: co2.id, contactId: ct2.id },
      { score: 87, status: "qualified",   campaignId: c1.id, companyId: co3.id, contactId: ct3.id },
      { score: 83, status: "replied",     campaignId: c2.id, companyId: co4.id, contactId: ct4.id },
      { score: 79, status: "qualified",   campaignId: c2.id, companyId: co5.id, contactId: ct5.id },
      { score: 76, status: "uncontacted", campaignId: c1.id, companyId: co6.id, contactId: ct6.id },
      { score: 72, status: "uncontacted", campaignId: c5.id, companyId: co7.id, contactId: ct7.id },
      { score: 68, status: "bounced",     campaignId: c2.id, companyId: co8.id, contactId: ct8.id },
    ],
  });

  // ── AI Agents ─────────────────────────────────────────────────────
  await prisma.aIAgent.createMany({
    data: [
      { name: "Research Agent",          type: "research",           status: "active", tasksTotal: 847 },
      { name: "Qualification Agent",     type: "qualification",      status: "active", tasksTotal: 614 },
      { name: "Contact Discovery Agent", type: "contact_discovery",  status: "active", tasksTotal: 392 },
      { name: "Email Verification Agent",type: "email_verification", status: "idle",   tasksTotal: 1204 },
      { name: "Outreach Agent",          type: "outreach",           status: "active", tasksTotal: 218 },
      { name: "Follow-up Agent",         type: "followup",           status: "paused", tasksTotal: 97 },
      { name: "Reporting Agent",         type: "reporting",          status: "active", tasksTotal: 34 },
    ],
  });

  // ── Integrations ──────────────────────────────────────────────────
  await prisma.integration.createMany({
    data: [
      { provider: "hubspot",   status: "connected",    organizationId: org.id },
      { provider: "linkedin",  status: "disconnected", organizationId: org.id },
      { provider: "slack",     status: "connected",    organizationId: org.id },
      { provider: "sendgrid",  status: "connected",    organizationId: org.id },
    ],
  });

  console.log("✓ Seed complete.");
  console.log("  Login: admin@a1intel.com / demo1234");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
