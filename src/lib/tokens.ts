import { randomBytes, createHash } from "crypto";
import { prisma } from "@/lib/prisma";

export type TokenPurpose = "password_reset" | "email_verify";

export const TOKEN_TTL_MS: Record<TokenPurpose, number> = {
  password_reset: 60 * 60 * 1000, // 1 hour — short, it's a credential
  email_verify: 24 * 60 * 60 * 1000, // 24 hours
};

/**
 * Only the hash is persisted; the raw value goes out in the email and is never
 * recoverable from the database. SHA-256 (not scrypt) is right here because the
 * input is already 256 bits of entropy — there is nothing to brute-force.
 */
export function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

/**
 * Issues a token, invalidating any outstanding ones for the same user+purpose
 * so a previously-emailed link stops working the moment a new one is requested.
 * Returns the raw token — the only time it exists in plaintext.
 */
export async function issueToken(userId: string, purpose: TokenPurpose): Promise<string> {
  const raw = randomBytes(32).toString("hex");

  await prisma.$transaction([
    prisma.verificationToken.updateMany({
      where: { userId, purpose, usedAt: null },
      data: { usedAt: new Date() },
    }),
    prisma.verificationToken.create({
      data: {
        userId,
        purpose,
        tokenHash: hashToken(raw),
        expiresAt: new Date(Date.now() + TOKEN_TTL_MS[purpose]),
      },
    }),
  ]);

  return raw;
}

/**
 * Atomically consumes a token. The `usedAt: null` guard in the update's where
 * clause makes redemption single-use even if two requests race.
 */
export async function consumeToken(
  raw: string,
  purpose: TokenPurpose
): Promise<{ userId: string } | null> {
  const record = await prisma.verificationToken.findUnique({
    where: { tokenHash: hashToken(raw) },
  });

  if (!record || record.purpose !== purpose) return null;
  if (record.usedAt) return null;
  if (record.expiresAt < new Date()) return null;

  const claimed = await prisma.verificationToken.updateMany({
    where: { id: record.id, usedAt: null },
    data: { usedAt: new Date() },
  });
  if (claimed.count === 0) return null; // lost the race

  return { userId: record.userId };
}
