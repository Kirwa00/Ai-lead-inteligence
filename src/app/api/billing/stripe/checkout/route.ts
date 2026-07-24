import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getStripe, stripeConfigured } from "@/lib/stripe";
import { CREDIT_PACKAGES } from "@/lib/packages";
import { packagePriceToValueMicros } from "@/lib/billing";

export const runtime = "nodejs";

const schema = z.object({ packageId: z.string() });

export async function POST(req: Request) {
  const session = await auth();
  const orgId = (session?.user as { organizationId?: string } | undefined)?.organizationId;
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!stripeConfigured()) {
    return NextResponse.json(
      { error: "Card payments aren't configured yet. Please try again later." },
      { status: 503 }
    );
  }

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid package." }, { status: 400 });

  const pkg = CREDIT_PACKAGES.find((p) => p.id === parsed.data.packageId);
  if (!pkg) return NextResponse.json({ error: "Unknown package." }, { status: 400 });

  const origin = new URL(req.url).origin;
  const valueMicros = packagePriceToValueMicros(pkg.priceUsd);

  try {
    const stripe = getStripe();
    const checkout = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: Math.round(pkg.priceUsd * 100),
            product_data: { name: `${pkg.name} credit package` },
          },
        },
      ],
      success_url: `${origin}/billing?topup=success`,
      cancel_url: `${origin}/billing?topup=cancelled`,
      metadata: { organizationId: orgId, packageId: pkg.id },
    });

    // Record a pending payment keyed by the Stripe session id; the webhook
    // credits the wallet on success (idempotent via the unique provider ref).
    await prisma.payment.create({
      data: {
        organizationId: orgId,
        userId: userId ?? null,
        provider: "stripe",
        providerRef: checkout.id,
        packageId: pkg.id,
        valueMicros,
        currency: "usd",
        status: "pending",
      },
    });

    return NextResponse.json({ url: checkout.url });
  } catch (err) {
    console.error("[stripe-checkout] error:", err);
    return NextResponse.json({ error: "Could not start checkout." }, { status: 500 });
  }
}
