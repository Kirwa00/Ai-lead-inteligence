// Thin Resend wrapper (raw REST call — no SDK dependency, matches how the
// rest of this codebase talks to external LLM providers).
//
// IMPORTANT: without a verified sending domain in Resend, the default sender
// "onboarding@resend.dev" only delivers to the email address your Resend
// account was created with — every other recipient will bounce. Verify a
// domain (Resend dashboard -> Domains) before sending real outreach.
export function resendConfigured(): boolean {
  return !!process.env.RESEND_API_KEY;
}

function toHtml(text: string): string {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return `<p>${escaped.replace(/\n/g, "<br/>")}</p>`;
}

export async function sendEmail(opts: {
  to: string;
  subject: string;
  text: string;
  /**
   * Overrides the platform sender. Outreach passes the workspace's own
   * verified address here; system mail (invites, password resets) leaves it
   * unset so it keeps coming from the platform.
   */
  from?: string | null;
}): Promise<{ id: string }> {
  const from = opts.from || process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: opts.to,
      subject: opts.subject,
      text: opts.text,
      html: toHtml(opts.text),
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.message || `Resend ${res.status}`);
  }
  return { id: data.id };
}
