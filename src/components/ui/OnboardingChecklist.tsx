import Link from "next/link";
import { getOnboardingState } from "@/lib/ux";

type Step = { label: string; href: string; done: boolean };

export default function OnboardingChecklist({
  hasCampaign,
  hasLeads,
  hasEmailSent,
}: {
  hasCampaign: boolean;
  hasLeads: boolean;
  hasEmailSent: boolean;
}) {
  const steps: Step[] = [
    { label: "Create your first campaign", href: "/campaigns/new", done: hasCampaign },
    { label: "Run the Research Agent to find leads", href: "/campaigns", done: hasLeads },
    { label: "Send your first outreach email", href: "/campaigns", done: hasEmailSent },
  ];

  const nextStep = steps.find((s) => !s.done);
  const onboardingState = getOnboardingState({ hasCampaign, hasLeads, hasEmailSent });

  return (
    <div className="bg-surface-container-low border border-primary/30 rounded-xl p-lg space-y-md">
      <div className="flex items-center justify-between gap-md">
        <div>
          <h2 className="text-headline-sm font-semibold text-on-surface">{onboardingState.headline}</h2>
          <p className="text-body-sm text-on-surface-variant mt-xs">{onboardingState.body}</p>
        </div>
        <span className="font-mono text-label-sm text-on-surface-variant whitespace-nowrap">
          {onboardingState.progressLabel}
        </span>
      </div>
      <div className="space-y-sm">
        {steps.map((step) => (
          <div key={step.label} className="flex items-center gap-md">
            <span
              className={`material-symbols-outlined text-body-md ${step.done ? "text-primary" : "text-on-surface-variant"}`}
              style={step.done ? { fontVariationSettings: "'FILL' 1" } : undefined}
            >
              {step.done ? "check_circle" : "radio_button_unchecked"}
            </span>
            <span className={`text-body-sm flex-1 ${step.done ? "text-on-surface-variant line-through" : "text-on-surface"}`}>
              {step.label}
            </span>
          </div>
        ))}
      </div>
      {nextStep && (
        <Link
          href={onboardingState.ctaHref}
          className="inline-flex items-center gap-xs px-md py-sm bg-primary-container text-on-primary-container font-mono text-label-md font-bold rounded-xl hover:brightness-105 transition-all active:scale-95"
        >
          <span className="material-symbols-outlined text-body-sm">arrow_forward</span>
          {onboardingState.ctaLabel}
        </Link>
      )}
    </div>
  );
}
