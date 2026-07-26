// Rough customer-facing cost per run (value, markup already included) shown
// in the UI as guidance only — the wallet always charges the real metered
// amount on completion, this is just so users aren't surprised.
export const ESTIMATED_COST_USD: Record<string, string> = {
  research: "~$0.05–0.20",
  qualification: "~$0.02–0.10",
  contact_discovery: "~$0.05–0.15",
  email_verification: "Free",
  outreach: "~$0.05–0.20",
  followup: "~$0.03–0.15",
  reporting: "~$0.02–0.08",
};
