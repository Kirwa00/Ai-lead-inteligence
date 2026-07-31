import { describe, expect, it } from "vitest";
import { getOnboardingState, getQuickStartState } from "./ux";

describe("getOnboardingState", () => {
  it("returns the next best action for a brand new workspace", () => {
    expect(getOnboardingState({ hasCampaign: false, hasLeads: false, hasEmailSent: false })).toEqual({
      headline: "Welcome aboard",
      body: "Create your first campaign to start the first AI-led outreach loop.",
      ctaLabel: "Create your first campaign",
      ctaHref: "/campaigns/new",
      progressLabel: "0 of 3 steps done",
    });
  });

  it("highlights the next action once a campaign exists", () => {
    expect(getOnboardingState({ hasCampaign: true, hasLeads: false, hasEmailSent: false })).toEqual({
      headline: "One step closer",
      body: "Add leads and run the Research Agent to turn that campaign into real outreach.",
      ctaLabel: "Add leads and research",
      ctaHref: "/campaigns",
      progressLabel: "1 of 3 steps done",
    });
  });
});

describe("getQuickStartState", () => {
  it("returns the first recommended action for a brand new workspace", () => {
    expect(getQuickStartState({ hasCampaign: false, hasLeads: false, hasEmailSent: false })).toEqual({
      title: "Quick start",
      intro: "Follow this path to launch your first outreach loop in a few minutes.",
      primaryLabel: "Create your first campaign",
      primaryHref: "/campaigns/new",
      secondaryLabel: "See the full guided checklist",
      secondaryHref: "/dashboard",
    });
  });
});
