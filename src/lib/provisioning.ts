import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { grantCredits } from "@/lib/wallet";
import { FREE_GRANT_MICROS } from "@/lib/billing";

export function slugify(input: string): string {
  const base = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return base || "workspace";
}

export function workspaceSlug(name: string): string {
  return `${slugify(name)}-${randomBytes(3).toString("hex")}`;
}

/**
 * Creates a solo workspace with the given person as its owner, plus the free
 * starter grant — the "no invite" signup path, shared by password registration
 * and first-time OAuth sign-in so both stay in lockstep.
 */
export async function provisionSoloWorkspace(input: {
  email: string;
  name: string;
  passwordHash?: string | null;
  image?: string | null;
  emailVerified?: Date | null;
  workspaceName?: string;
}): Promise<{ userId: string; organizationId: string }> {
  const workspaceName = input.workspaceName?.trim() || `${input.name}'s Workspace`;

  return prisma.$transaction(async (tx) => {
    const org = await tx.organization.create({
      data: { name: workspaceName, slug: workspaceSlug(workspaceName), plan: "free" },
    });
    const user = await tx.user.create({
      data: {
        email: input.email,
        name: input.name,
        passwordHash: input.passwordHash ?? null,
        image: input.image ?? null,
        emailVerified: input.emailVerified ?? null,
        role: "owner",
        organizationId: org.id,
      },
    });
    await grantCredits(tx, org.id, FREE_GRANT_MICROS, "Free starter credits");
    return { userId: user.id, organizationId: org.id };
  });
}
