// Shared industry options used by the Research Agent and Campaign forms.
// Broad cross-sector coverage; "Other" is always last for anything not listed.
export const INDUSTRIES = [
  // Finance
  "FinTech",
  "Banking",
  "Insurance / InsurTech",
  "Investment / Asset Management",
  "Private Equity / Venture Capital",
  "Accounting / Tax",
  "Payments",
  "Lending / Credit",
  "Blockchain / Web3 / Crypto",

  // Software & Technology
  "SaaS",
  "AI / Machine Learning",
  "Cybersecurity",
  "Cloud / DevOps / IT Services",
  "Data & Analytics",
  "Developer Tools",
  "IoT / Hardware",
  "Semiconductors / Electronics",
  "Robotics / Automation",
  "Telecom",
  "Gaming",

  // Commerce & Consumer
  "E-commerce / Retail",
  "Consumer Goods / FMCG",
  "Wholesale / Distribution",
  "Fashion & Apparel",
  "Beauty & Cosmetics",
  "Luxury Goods & Jewelry",
  "Furniture & Home",
  "Pet Care / Products",
  "Sports & Fitness",

  // Health & Life Sciences
  "Healthcare",
  "HealthTech / Telemedicine",
  "Hospitals & Clinics",
  "Medical Devices",
  "Pharmaceuticals",
  "Biotech",
  "Life Sciences",
  "Mental Health & Wellness",
  "Diagnostics / Labs",
  "Elder Care / Senior Living",

  // Industrial & Physical
  "Manufacturing",
  "Industrial Equipment / Machinery",
  "Automotive",
  "Aerospace & Defense",
  "Chemicals",
  "Steel & Metals",
  "Building Materials",
  "Packaging & Printing",
  "Textiles",

  // Logistics & Mobility
  "Logistics",
  "Supply Chain",
  "Transportation / Mobility",
  "Warehousing & Fulfilment",
  "Courier & Last-Mile Delivery",
  "Aviation / Airlines",
  "Maritime / Shipping",

  // Agriculture, Food & Environment
  "AgriTech",
  "Agriculture",
  "Food & Beverage",
  "Restaurants / Food Service",
  "Fisheries / Aquaculture",
  "Forestry",
  "Waste Management / Recycling",
  "Water & Sanitation",
  "Environmental Services",

  // Energy & Resources
  "CleanTech / Renewable Energy",
  "Oil & Gas",
  "Energy & Utilities",
  "Mining",

  // Property & Built Environment
  "Real Estate / PropTech",
  "Construction",
  "Architecture & Engineering",
  "Facilities Management",

  // Services & Professional
  "Professional Services / Consulting",
  "Legal / LegalTech",
  "HR / Recruitment / Staffing",
  "Marketing & Advertising",
  "PR / Communications",
  "Design / Creative Agency",
  "Customer Support / BPO",
  "Market Research",
  "Security Services",

  // Education
  "EdTech",
  "Universities / Higher Education",
  "Schools (K-12)",
  "Vocational / Corporate Training",

  // Media, Travel & Leisure
  "Media & Entertainment",
  "Publishing",
  "Film & Video Production",
  "Music & Audio",
  "Hospitality / Travel",
  "Events & Conferences",

  // Public & Social
  "Government / Public Sector",
  "Nonprofit / NGO",
  "Associations / Membership",
  "Religious Organizations",

  "Other",
] as const;
