import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";
import { grantCredits } from "@/lib/wallet";

export const runtime = "nodejs";

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export async function POST(req: Request) {
  const expected = process.env.FLW_SECRET_HASH;
  const got = req.headers.get("verif-hash");
  // Flutterwave authenticates webhooks with a static hash header you configure.
  if (!expected || !got || !safeEqual(got, expected)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    event?: string;
    data?: { status?: string; tx_ref?: string };
  };

  const txRef = body.data?.tx_ref;
  const successful = body.data?.status === "successful";

  if (successful && txRef) {
    try {
      await prisma.$transaction(async (tx) => {
        const pay = await tx.payment.findUnique({
          where: { provider_providerRef: { provider: "flutterwave", providerRef: txRef } },
        });
        if (!pay || pay.status === "succeeded") return; // idempotent

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
      console.error("[flutterwave-webhook] crediting failed:", err);
      return NextResponse.json({ error: "Processing failed" }, { status: 500 });
    }
  }

  return NextResponse.json({ received: true });
}
