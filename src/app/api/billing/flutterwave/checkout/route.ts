import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { CREDIT_PACKAGES } from "@/lib/packages";
import { packagePriceToValueMicros } from "@/lib/billing";
import {
  flutterwaveConfigured,
  createPaymentLink,
  flwCurrency,
  usdToChargeAmount,
} from "@/lib/flutterwave";

export const runtime = "nodejs";

const schema = z.object({ packageId: z.string() });

export async function POST(req: Request) {
  const session = await auth();
  const orgId = (session?.user as { organizationId?: string } | undefined)?.organizationId;
  const userId = (session?.user as { id?: string } | undefined)?.id;
  const email = (session?.user as { email?: string } | undefined)?.email ?? "customer@example.com";
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!flutterwaveConfigured()) {
    return NextResponse.json(
      { error: "M-Pesa / Flutterwave isn't configured yet. Please try again later." },
      { status: 503 }
    );
  }

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid package." }, { status: 400 });

  const pkg = CREDIT_PACKAGES.find((p) => p.id === parsed.data.packageId);
  if (!pkg) return NextResponse.json({ error: "Unknown package." }, { status: 400 });

  const origin = new URL(req.url).origin;
  const txRef = `flw_${randomBytes(10).toString("hex")}`;
  const valueMicros = packagePriceToValueMicros(pkg.priceUsd);
  const currency = flwCurrency();

  try {
    // Record the pending payment first (keyed by our tx_ref) so the webhook
    // can credit idempotently even if the redirect never happens.
    await prisma.payment.create({
      data: {
        organizationId: orgId,
        userId: userId ?? null,
        provider: "flutterwave",
        providerRef: txRef,
        packageId: pkg.id,
        valueMicros,
        currency,
        status: "pending",
      },
    });

    const link = await createPaymentLink({
      txRef,
      amount: usdToChargeAmount(pkg.priceUsd),
      currency,
      redirectUrl: `${origin}/billing?topup=success`,
      email,
      meta: { organizationId: orgId, packageId: pkg.id },
    });

    return NextResponse.json({ url: link });
  } catch (err) {
    console.error("[flutterwave-checkout] error:", err);
    return NextResponse.json({ error: "Could not start checkout." }, { status: 500 });
  }
}
