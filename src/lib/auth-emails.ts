import { sendEmail, resendConfigured } from "@/lib/email-sender";

/**
 * Transactional auth emails. Every helper resolves to whether the mail actually
 * went out, so callers can fall back to showing the link on screen in dev (or
 * wherever RESEND_API_KEY isn't configured) instead of stranding the user.
 * A send failure is logged but never thrown — it must not fail the request that
 * triggered it (e.g. signup should still succeed if email is down).
 */
async function trySend(to: string, subject: string, text: string): Promise<boolean> {
  if (!resendConfigured()) return false;
  try {
    await sendEmail({ to, subject, text });
    return true;
  } catch (err) {
    console.error(`[auth-email] failed to send "${subject}":`, err);
    return false;
  }
}

export function sendPasswordResetEmail(to: string, url: string): Promise<boolean> {
  return trySend(
    to,
    "Reset your A1 Intelligence password",
    `We received a request to reset your password.\n\nReset it here: ${url}\n\nThis link expires in 1 hour and can only be used once. If you didn't request this, you can safely ignore this email — your password won't change.`
  );
}

export function sendVerificationEmail(to: string, url: string): Promise<boolean> {
  return trySend(
    to,
    "Confirm your A1 Intelligence email",
    `Welcome to A1 Intelligence.\n\nConfirm your email address: ${url}\n\nThis link expires in 24 hours.`
  );
}
