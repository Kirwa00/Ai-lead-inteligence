const FLW_BASE = "https://api.flutterwave.com/v3";

export function flutterwaveConfigured(): boolean {
  return !!process.env.FLW_SECRET_KEY;
}

/** Payment currency + FX. Wallet always credits USD value; the customer can be
 *  charged in KES (for M-Pesa) via FLW_CURRENCY=KES + USD_TO_KES rate. */
export function flwCurrency(): string {
  return process.env.FLW_CURRENCY || "USD";
}

export function usdToChargeAmount(priceUsd: number): number {
  const rate = flwCurrency() === "KES" ? Number(process.env.USD_TO_KES || 130) : 1;
  return Math.round(priceUsd * rate);
}

/** Create a hosted Flutterwave payment link; returns the checkout URL. */
export async function createPaymentLink(opts: {
  txRef: string;
  amount: number;
  currency: string;
  redirectUrl: string;
  email: string;
  meta?: Record<string, string>;
}): Promise<string> {
  const res = await fetch(`${FLW_BASE}/payments`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.FLW_SECRET_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      tx_ref: opts.txRef,
      amount: opts.amount,
      currency: opts.currency,
      redirect_url: opts.redirectUrl,
      payment_options: "card, mobilemoneyghana, mpesa",
      customer: { email: opts.email },
      meta: opts.meta,
      customizations: {
        title: "A1 Lead Intelligence",
        description: "Credit top-up",
      },
    }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    status?: string;
    message?: string;
    data?: { link?: string };
  };
  if (data.status !== "success" || !data.data?.link) {
    throw new Error(data.message || "Flutterwave initialisation failed");
  }
  return data.data.link;
}
