import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { grantCredits } from "@/lib/wallet";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const sig = req.headers.get("stripe-signature");
  if (!secret || !sig) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 400 });
  }

  // Raw body is required for signature verification — do not JSON.parse first.
  const raw = await req.text();

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(raw, sig, secret);
  } catch (err) {
    console.error("[stripe-webhook] signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const s = event.data.object as Stripe.Checkout.Session;
    try {
      await prisma.$transaction(async (tx) => {
        const pay = await tx.payment.findUnique({
          where: { provider_providerRef: { provider: "stripe", providerRef: s.id } },
        });
        // Unknown or already-credited → no-op (idempotent on retries).
        if (!pay || pay.status === "succeeded") return;

        await grantCredits(
          tx,
          pay.organizationId,
          pay.valueMicros,
          `Top-up (${pay.packageId ?? "custom"})`,
          "topup"
        );
        await tx.payment.update({ where: { id: pay.id }, data: { status: "succeeded" } });
      });
    } catch (err) {
      console.error("[stripe-webhook] crediting failed:", err);
      return NextResponse.json({ error: "Processing failed" }, { status: 500 });
    }
  }

  return NextResponse.json({ received: true });
}
