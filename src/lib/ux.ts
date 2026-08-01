export type OnboardingState = {
  headline: string;
  body: string;
  ctaLabel: string;
  ctaHref: string;
  progressLabel: string;
};

export type QuickStartState = {
  title: string;
  intro: string;
  primaryLabel: string;
  primaryHref: string;
  secondaryLabel: string;
  secondaryHref: string;
};

export function getOnboardingState({
  hasCampaign,
  hasLeads,
  hasEmailSent,
}: {
  hasCampaign: boolean;
  hasLeads: boolean;
  hasEmailSent: boolean;
}): OnboardingState {
  const completed = [hasCampaign, hasLeads, hasEmailSent].filter(Boolean).length;

  if (!hasCampaign) {
    return {
      headline: "Welcome aboard",
      body: "Create your first campaign to start the first AI-led outreach loop.",
      ctaLabel: "Create your first campaign",
      ctaHref: "/campaigns/new",
      progressLabel: `${completed} of 3 steps done`,
    };
  }

  if (!hasLeads) {
    return {
      headline: "One step closer",
      body: "Add leads and run the Research Agent to turn that campaign into real outreach.",
      ctaLabel: "Add leads and research",
      ctaHref: "/campaigns",
      progressLabel: `${completed} of 3 steps done`,
    };
  }

  return {
    headline: "Almost ready",
    body: "Send your first outreach email to start conversations with your leads.",
    ctaLabel: "Send your first outreach",
    ctaHref: "/campaigns",
    progressLabel: `${completed} of 3 steps done`,
  };
}

export function getQuickStartState({
  hasCampaign,
  hasLeads,
}: {
  hasCampaign: boolean;
  hasLeads: boolean;
  hasEmailSent: boolean;
}): QuickStartState {
  if (!hasCampaign) {
    return {
      title: "Quick start",
      intro: "Follow this path to launch your first outreach loop in a few minutes.",
      primaryLabel: "Create your first campaign",
      primaryHref: "/campaigns/new",
      secondaryLabel: "See the full guided checklist",
      secondaryHref: "/dashboard",
    };
  }

  if (!hasLeads) {
    return {
      title: "Quick start",
      intro: "You already have a campaign. Add leads and let the Research Agent build the first list.",
      primaryLabel: "Add leads and research",
      primaryHref: "/campaigns",
      secondaryLabel: "See the full guided checklist",
      secondaryHref: "/dashboard",
    };
  }

  return {
    title: "Quick start",
    intro: "Your workspace is ready. Send outreach and keep the momentum going.",
    primaryLabel: "Send your first outreach",
    primaryHref: "/campaigns",
    secondaryLabel: "See the full guided checklist",
    secondaryHref: "/dashboard",
  };
}
