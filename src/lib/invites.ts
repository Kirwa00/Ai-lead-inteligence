import { randomBytes } from "crypto";

export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export function generateInviteToken(): string {
  return randomBytes(24).toString("hex");
}
