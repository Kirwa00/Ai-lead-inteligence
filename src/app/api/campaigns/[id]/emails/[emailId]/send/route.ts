import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail, resendConfigured } from "@/lib/email-sender";
import { rateLimit, tooMany } from "@/lib/rate-limit";
import { resolveOutreachFrom } from "@/lib/sending-domain";

export const runtime = "nodejs";

// Sends one drafted outreach/follow-up email via Resend. Sending is a real,
// hard-to-undo action (see safety rules), so this is an explicit user click —
// no agent sends automatically.
export async function POST(
  _req: Request,
  { params }: { params: { id: string; emailId: string } }
) {
  const session = await auth();
  const orgId = (session?.user as { organizationId?: string } | undefined)?.organizationId;
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!resendConfigured()) {
    return NextResponse.json({ error: "Email sending isn't configured yet." }, { status: 503 });
  }

  const rl = rateLimit(`send-email:${orgId}`, 30, 60 * 1000); // 30 sends / minute / org
  if (!rl.ok) return tooMany(rl.retryAfterSec, "Too many emails sent. Please wait a moment.");

  // Org-scoped through the campaign relation — the email row alone doesn't
  // carry the org id.
  const email = await prisma.email.findFirst({
    where: { id: params.emailId, campaignId: params.id, campaign: { organizationId: orgId } },
    include: { lead: { include: { contact: true, company: true } } },
  });
  if (!email) return NextResponse.json({ error: "Email not found" }, { status: 404 });
  if (email.status !== "draft") {
    return NextResponse.json({ error: `Already ${email.status}.` }, { status: 409 });
  }

  const to = email.lead?.contact?.email;
  if (!to) {
    return NextResponse.json({ error: "This lead has no contact email on file." }, { status: 400 });
  }

  // Send as the workspace's own verified domain when they have one. Without it
  // we fall back to the platform sender, which for outreach only reaches the
  // Resend account owner's inbox — so the response flags that explicitly rather
  // than letting the user believe a prospect was contacted.
  const from = await resolveOutreachFrom(orgId);

  try {
    await sendEmail({ to, subject: email.subject, text: email.body, from });
  } catch (err) {
    console.error("[send-email] Resend error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Sending failed." },
      { status: 502 }
    );
  }

  // Advance uncontacted/qualified leads to "contacted"; never downgrade a
  // lead that has already replied or booked a meeting (e.g. a follow-up sent
  // after the fact shouldn't erase that progress).
  const shouldAdvance =
    email.lead && ["uncontacted", "qualified"].includes(email.lead.status);

  await prisma.$transaction([
    prisma.email.update({ where: { id: email.id }, data: { status: "sent", sentAt: new Date() } }),
    ...(shouldAdvance
      ? [prisma.lead.update({ where: { id: email.leadId as string }, data: { status: "contacted" } })]
      : []),
  ]);

  return NextResponse.json({
    ok: true,
    sentTo: to,
    sentFrom: from,
    // Surfaced by the UI so an unverified workspace understands why a prospect
    // may never receive this.
    usingPlatformSender: !from,
  });
}
