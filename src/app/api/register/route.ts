import { NextResponse } from "next/server";
import { z } from "zod";
import { randomBytes } from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { grantCredits } from "@/lib/wallet";
import { FREE_GRANT_MICROS } from "@/lib/billing";
import { rateLimit, clientIp, tooMany } from "@/lib/rate-limit";

export const runtime = "nodejs";

const registerSchema = z.object({
  name: z.string().trim().min(1, "Your name is required.").max(120),
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters.").max(200),
  workspace: z.string().trim().max(120).optional(),
});

function slugify(input: string): string {
  const base = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return base || "workspace";
}

export async function POST(req: Request) {
  // Throttle signups per IP — each account grants real token budget, so this
  // blocks scripted free-grant farming that would drain Anthropic credits.
  const rl = rateLimit(`register:${clientIp(req)}`, 5, 60 * 60 * 1000); // 5 / hour / IP
  if (!rl.ok) return tooMany(rl.retryAfterSec, "Too many sign-ups from this network. Try again later.");

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input." },
      { status: 400 }
    );
  }

  const { name, email, password, workspace } = parsed.data;

  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json(
      { error: "An account with this email already exists." },
      { status: 409 }
    );
  }

  const workspaceName =
    workspace && workspace.length > 0 ? workspace : `${name}'s Workspace`;
  const slug = `${slugify(workspaceName)}-${randomBytes(3).toString("hex")}`;
  const passwordHash = await hashPassword(password);

  try {
    // A solo signup provisions its own Organization (workspace) with the
    // registrant as owner. Billing later attaches at the Organization level.
    await prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: { name: workspaceName, slug, plan: "free" },
      });
      await tx.user.create({
        data: {
          email,
          name,
          passwordHash,
          role: "owner",
          organizationId: org.id,
        },
      });
      // Free starter grant so new workspaces can try the AI agents before paying.
      await grantCredits(tx, org.id, FREE_GRANT_MICROS, "Free starter credits");
    });
  } catch (err) {
    // Unique-constraint race (email or slug) or any other write failure.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json(
        { error: "An account with this email already exists." },
        { status: 409 }
      );
    }
    console.error("[register] failed to create account:", err);
    return NextResponse.json(
      { error: "Could not create your account. Please try again." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
