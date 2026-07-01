export const demoCampaigns = [
  { id: "1", name: "Kenya FinTech Outreach Q3", status: "active", industry: "FinTech", geography: "Kenya", leads: 142, replied: 31, meetings: 8, created: "2026-06-01" },
  { id: "2", name: "East Africa SaaS CEOs", status: "active", industry: "SaaS", geography: "East Africa", leads: 89, replied: 18, meetings: 4, created: "2026-06-10" },
  { id: "3", name: "Nairobi Real Estate Q3", status: "paused", industry: "Real Estate", geography: "Nairobi", leads: 211, replied: 47, meetings: 12, created: "2026-05-20" },
  { id: "4", name: "Pan-Africa Healthcare", status: "active", industry: "Healthcare", geography: "Pan-Africa", leads: 54, replied: 9, meetings: 2, created: "2026-06-18" },
  { id: "5", name: "Logistics & Supply Chain", status: "validating", industry: "Logistics", geography: "Kenya", leads: 76, replied: 0, meetings: 0, created: "2026-06-25" },
  { id: "6", name: "EdTech East Africa", status: "draft", industry: "EdTech", geography: "East Africa", leads: 0, replied: 0, meetings: 0, created: "2026-06-29" },
];

export const demoLeads = [
  { id: "1", company: "Safaricom PLC", contact: "Peter Ndegwa", title: "CEO", email: "p.ndegwa@safaricom.co.ke", score: 94, status: "qualified", industry: "Telecom", campaignId: "1" },
  { id: "2", company: "Equity Bank Kenya", contact: "James Mwangi", title: "Group MD", email: "j.mwangi@equitybank.co.ke", score: 91, status: "contacted", industry: "Banking", campaignId: "1" },
  { id: "3", company: "KPLC", contact: "Rosemary Oduor", title: "CEO", email: "r.oduor@kplc.co.ke", score: 87, status: "qualified", industry: "Energy", campaignId: "1" },
  { id: "4", company: "Twiga Foods", contact: "Grant Brooke", title: "Co-Founder", email: "grant@twiga.com", score: 83, status: "replied", industry: "AgriTech", campaignId: "2" },
  { id: "5", company: "M-KOPA Solar", contact: "Maarten Sprenger", title: "CFO", email: "m.sprenger@m-kopa.com", score: 79, status: "qualified", industry: "CleanTech", campaignId: "2" },
  { id: "6", company: "Pezesha Africa", contact: "Hilda Moraa", title: "CEO", email: "hilda@pezesha.com", score: 76, status: "uncontacted", industry: "FinTech", campaignId: "1" },
  { id: "7", company: "Sendy Ltd", contact: "Meshack Alloys", title: "CTO", email: "m.alloys@sendy.co.ke", score: 72, status: "uncontacted", industry: "Logistics", campaignId: "5" },
  { id: "8", company: "Farmshine", contact: "Alice Kamau", title: "COO", email: "alice@farmshine.africa", score: 68, status: "bounced", industry: "AgriTech", campaignId: "2" },
];

export const demoAgents = [
  {
    id: "1", name: "Research Agent", type: "research", icon: "travel_explore", status: "active",
    tasksToday: 847, accuracy: "94.2%", avgLatency: "1.2s",
    currentTask: "Scanning SaaS companies in Nairobi tech hub",
    description: "Discovers companies matching your ICP across the web, LinkedIn, and business directories.",
    capabilities: ["Web scraping", "LinkedIn lookup", "Company profiling", "Industry classification"],
  },
  {
    id: "2", name: "Qualification Agent", type: "qualification", icon: "verified", status: "active",
    tasksToday: 614, accuracy: "91.8%", avgLatency: "0.8s",
    currentTask: "Scoring 23 new FinTech prospects",
    description: "Scores and ranks companies against your ICP criteria using a weighted scoring model.",
    capabilities: ["ICP scoring", "Revenue estimation", "Growth signal detection", "Rank ordering"],
  },
  {
    id: "3", name: "Contact Discovery Agent", type: "contact_discovery", icon: "contacts", status: "active",
    tasksToday: 392, accuracy: "88.5%", avgLatency: "2.1s",
    currentTask: "Finding C-suite contacts at Equity Bank",
    description: "Finds decision-makers and their verified business emails for qualified companies.",
    capabilities: ["Title matching", "Email pattern generation", "LinkedIn enrichment", "Phone lookup"],
  },
  {
    id: "4", name: "Email Verification Agent", type: "email_verification", icon: "mark_email_read", status: "idle",
    tasksToday: 1204, accuracy: "99.1%", avgLatency: "0.4s",
    currentTask: "Awaiting next batch",
    description: "Validates email deliverability and detects risky or catch-all addresses before sending.",
    capabilities: ["SMTP verification", "Catch-all detection", "Disposable detection", "Confidence scoring"],
  },
  {
    id: "5", name: "Outreach Agent", type: "outreach", icon: "send", status: "active",
    tasksToday: 218, accuracy: "—", avgLatency: "3.4s",
    currentTask: "Writing personalised intro emails for Twiga Foods campaign",
    description: "Generates hyper-personalised email and LinkedIn messages using company research context.",
    capabilities: ["Email personalisation", "LinkedIn messages", "Follow-up sequences", "Subject line optimisation"],
  },
  {
    id: "6", name: "Follow-up Agent", type: "followup", icon: "reply_all", status: "paused",
    tasksToday: 97, accuracy: "—", avgLatency: "—",
    currentTask: "Paused — awaiting human approval to resume",
    description: "Monitors inboxes, classifies replies, and schedules intelligent follow-up touchpoints.",
    capabilities: ["Reply classification", "Meeting detection", "Objection handling", "Auto-scheduling"],
  },
  {
    id: "7", name: "Reporting Agent", type: "reporting", icon: "assessment", status: "active",
    tasksToday: 34, accuracy: "—", avgLatency: "0.9s",
    currentTask: "Generating weekly performance report",
    description: "Builds live dashboards, computes KPIs, and recommends campaign optimisations.",
    capabilities: ["KPI computation", "Trend analysis", "Anomaly detection", "PDF report generation"],
  },
];

export const demoReports = [
  { id: "1", name: "Weekly Performance Report", date: "2026-06-28", type: "Automated", leads: 312, meetings: 14 },
  { id: "2", name: "FinTech Campaign Analysis", date: "2026-06-21", type: "Campaign", leads: 142, meetings: 8 },
  { id: "3", name: "Monthly KPI Summary – June", date: "2026-06-01", type: "Monthly", leads: 1402, meetings: 94 },
  { id: "4", name: "East Africa SaaS Deep Dive", date: "2026-05-30", type: "Campaign", leads: 89, meetings: 4 },
];

export const demoKpis = {
  qualifiedLeads: 1402,
  responseRate: 42.8,
  activeCampaigns: 24,
  aiEfficiency: 99.2,
  emailDeliverability: 98.7,
  meetingRate: 6.7,
  leadAccuracy: 94.2,
  replyRate: 42.8,
};
