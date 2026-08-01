import Link from "next/link";
import AuthShell from "@/components/layout/AuthShell";

const RESULTS: Record<string, { title: string; icon: string; tone: string; body: string }> = {
  success: {
    title: "Email confirmed",
    icon: "check_circle",
    tone: "text-primary",
    body: "Thanks — your email address is verified. You're all set.",
  },
  invalid: {
    title: "Link no longer valid",
    icon: "error",
    tone: "text-error",
    body: "This confirmation link is invalid, expired, or already used. Sign in and request a fresh one from the banner at the top of the app.",
  },
};

export default function VerifyEmailPage({
  searchParams,
}: {
  searchParams: { status?: string };
}) {
  const result = RESULTS[searchParams.status ?? ""] ?? RESULTS.invalid;

  return (
    <AuthShell
      title={result.title}
      footer={
        <Link href="/dashboard" className="text-primary hover:underline">
          Go to dashboard
        </Link>
      }
    >
      <p className="flex items-start gap-sm text-body-sm text-on-surface-variant">
        <span className={`material-symbols-outlined text-body-md ${result.tone}`}>{result.icon}</span>
        {result.body}
      </p>
    </AuthShell>
  );
}
