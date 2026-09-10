import type { TemplateDomain, TemplateSpec } from "../types";

interface BusinessType {
  slug: string;
  name: string;
  /** The thing that most often kills this kind of business. */
  crux: string;
  /** First real proof it works. */
  proof: string;
  weeks: number;
  difficulty: number;
}

const BUSINESSES: BusinessType[] = [
  { slug: "consultancy", name: "a consultancy", crux: "Positioning and pricing", proof: "First paid engagement", weeks: 36, difficulty: 3 },
  { slug: "agency", name: "an agency", crux: "Repeatable delivery and hiring", proof: "Three retained clients", weeks: 52, difficulty: 4 },
  { slug: "ecommerce", name: "an ecommerce store", crux: "Margins and acquisition cost", proof: "First hundred profitable orders", weeks: 44, difficulty: 4 },
  { slug: "dropshipping", name: "an online reselling business", crux: "Supplier reliability and margin", proof: "Consistent profitable months", weeks: 36, difficulty: 3 },
  { slug: "cafe", name: "a café", crux: "Unit economics and staffing", proof: "First profitable month", weeks: 72, difficulty: 5 },
  { slug: "restaurant", name: "a restaurant", crux: "Cost control and consistency", proof: "First profitable quarter", weeks: 88, difficulty: 5 },
  { slug: "food-truck", name: "a food business", crux: "Licensing and pitch selection", proof: "First profitable trading month", weeks: 52, difficulty: 4 },
  { slug: "bakery", name: "a bakery business", crux: "Production capacity and waste", proof: "Regular wholesale or retail orders", weeks: 52, difficulty: 4 },
  { slug: "online-course", name: "an online course business", crux: "Audience before product", proof: "First cohort completed and paid", weeks: 40, difficulty: 3 },
  { slug: "coaching", name: "a coaching practice", crux: "Credibility and results", proof: "Five paying clients", weeks: 36, difficulty: 3 },
  { slug: "photography-business", name: "a photography business", crux: "Portfolio and booking pipeline", proof: "Fully booked month", weeks: 44, difficulty: 3 },
  { slug: "cleaning", name: "a cleaning business", crux: "Scheduling and reliable staff", proof: "Ten recurring contracts", weeks: 36, difficulty: 3 },
  { slug: "landscaping", name: "a gardening business", crux: "Seasonality and equipment cost", proof: "Full season of recurring work", weeks: 40, difficulty: 3 },
  { slug: "trades-business", name: "a trades business", crux: "Quoting accurately", proof: "Consistent booked work", weeks: 44, difficulty: 4 },
  { slug: "property-rental", name: "a property rental", crux: "Cashflow and tenant management", proof: "First year cashflow positive", weeks: 60, difficulty: 4 },
  { slug: "newsletter", name: "a paid newsletter", crux: "Consistent writing and audience growth", proof: "First hundred paying subscribers", weeks: 44, difficulty: 3 },
  { slug: "app-business", name: "an app business", crux: "Retention, not downloads", proof: "First recurring revenue", weeks: 52, difficulty: 4 },
  { slug: "marketplace", name: "a marketplace", crux: "Solving the cold-start problem", proof: "First organic transactions", weeks: 72, difficulty: 5 },
  { slug: "subscription-box", name: "a subscription business", crux: "Churn and fulfilment cost", proof: "First hundred retained subscribers", weeks: 48, difficulty: 4 },
  { slug: "nonprofit", name: "a nonprofit", crux: "Funding model and governance", proof: "First funded programme delivered", weeks: 60, difficulty: 4 },
];

function startBusiness(b: BusinessType): TemplateSpec {
  return {
    key: `business-start-${b.slug}`,
    title: `Start ${b.name}`,
    summary: `Go from idea to a real, trading business. The thing that most often decides it: ${b.crux.toLowerCase()}.`,
    category: "business",
    difficulty: b.difficulty,
    weeks: b.weeks,
    tags: [b.slug.replace(/-/g, " "), "business", "startup", "entrepreneur", "self-employed"],
    skills: ["Customer and market validation", b.crux, "Legal and financial setup", "Getting first customers", "Operations and delivery"],
    milestones: ["Idea validated with real conversations", "Legally set up and ready to trade", "First paying customer", b.proof],
  };
}

const generated = BUSINESSES.map(startBusiness);

const extras: TemplateSpec[] = [
  {
    key: "business-validate-idea",
    title: "Validate a business idea before building it",
    summary: "Find out whether anyone wants it before spending a year finding out they don't.",
    category: "business",
    difficulty: 2,
    weeks: 12,
    tags: ["validation", "customer discovery", "startup", "research"],
    skills: ["Problem interviews", "Avoiding leading questions", "Demand testing", "Honest interpretation"],
    milestones: ["Ten problem interviews done", "Pattern identified", "Demand test run", "Go or no-go decision made honestly"],
  },
  {
    key: "business-write-plan",
    title: "Write a business plan that's actually useful",
    summary: "A working document for decisions and funding, not a fifty-page exercise.",
    category: "business",
    difficulty: 2,
    weeks: 10,
    tags: ["business plan", "strategy", "funding", "planning"],
    skills: ["Market analysis", "Financial projections", "Operating model", "Clear writing"],
    milestones: ["Model and numbers drafted", "Financials stress-tested", "Plan written", "Reviewed by someone experienced"],
  },
  {
    key: "business-first-customers",
    title: "Get your first ten customers",
    summary: "The hardest ten you will ever get, and the ones that teach you the most.",
    category: "business",
    difficulty: 3,
    weeks: 20,
    tags: ["customers", "sales", "traction", "startup"],
    skills: ["Direct outreach", "Offer clarity", "Handling objections", "Learning from every conversation"],
    milestones: ["Outreach list built", "First customer", "Five customers", "Ten customers"],
    metric: { name: "Paying customers", target: 10, unit: "customers" },
  },
  {
    key: "business-pricing",
    title: "Fix your pricing",
    summary: "Most small businesses undercharge badly. Work out what your work is actually worth.",
    category: "business",
    difficulty: 3,
    weeks: 12,
    tags: ["pricing", "value", "margin", "business"],
    skills: ["Cost and margin analysis", "Value-based pricing", "Competitor research", "Communicating a price rise"],
    milestones: ["True costs understood", "New pricing designed", "Tested with new customers", "Rolled out to existing customers"],
  },
  {
    key: "business-marketing-basics",
    title: "Learn marketing that actually works",
    summary: "Positioning and channels rather than posting into the void.",
    category: "business",
    difficulty: 3,
    weeks: 24,
    tags: ["marketing", "positioning", "channels", "growth"],
    skills: ["Positioning and messaging", "Audience research", "Channel selection", "Measurement", "Iteration"],
    milestones: ["Positioning written", "One channel chosen and tested", "Measurable results", "Repeatable acquisition"],
  },
  {
    key: "business-sales-skills",
    title: "Learn to sell without feeling sleazy",
    summary: "Sales as diagnosis and fit rather than persuasion and pressure.",
    category: "business",
    difficulty: 3,
    weeks: 20,
    tags: ["sales", "selling", "pitching", "business"],
    skills: ["Discovery questioning", "Listening", "Handling objections", "Closing and follow-up"],
    milestones: ["Discovery script working", "Ten sales conversations held", "First close", "Consistent conversion"],
  },
  {
    key: "business-build-brand",
    title: "Build a brand people remember",
    summary: "Consistent identity and voice, not just a logo.",
    category: "business",
    difficulty: 3,
    weeks: 24,
    tags: ["brand", "identity", "design", "voice"],
    skills: ["Brand positioning", "Visual identity", "Voice and messaging", "Consistent application"],
    milestones: ["Positioning defined", "Visual identity finished", "Applied everywhere", "Recognised by customers"],
  },
  {
    key: "business-hire-first-employee",
    title: "Hire your first employee",
    summary: "The legal, financial and human step from working alone to employing someone.",
    category: "business",
    difficulty: 4,
    weeks: 20,
    tags: ["hiring", "employment", "team", "growth"],
    skills: ["Role definition", "Legal and payroll setup", "Interviewing", "Onboarding", "Managing someone"],
    milestones: ["Role and budget defined", "Legally ready to employ", "Hired", "Productive and settled"],
  },
  {
    key: "business-systems",
    title: "Systemise your business so it runs without you",
    summary: "Documented processes so the business is not entirely inside your head.",
    category: "business",
    difficulty: 4,
    weeks: 32,
    tags: ["systems", "processes", "delegation", "operations"],
    skills: ["Process mapping", "Documentation", "Delegation", "Quality control"],
    milestones: ["Core processes mapped", "Documented and usable", "First process fully delegated", "A week off without problems"],
  },
  {
    key: "business-raise-funding",
    title: "Raise funding for your business",
    summary: "Get investment-ready and run a real fundraising process.",
    category: "business",
    difficulty: 5,
    weeks: 40,
    tags: ["funding", "investors", "pitch", "startup", "capital"],
    skills: ["Investment readiness", "Financial modelling", "Pitch and deck", "Investor pipeline", "Due diligence and terms"],
    milestones: ["Metrics and model ready", "Deck finished", "Twenty investor conversations", "Round closed"],
  },
  {
    key: "business-exit",
    title: "Prepare your business for sale",
    summary: "Make the business saleable — clean books, documented systems, reduced key-person risk.",
    category: "business",
    difficulty: 5,
    weeks: 60,
    tags: ["exit", "sale", "valuation", "business"],
    skills: ["Financial cleanup", "Reducing owner dependence", "Valuation understanding", "Buyer search", "Negotiation and diligence"],
    milestones: ["Books clean and audited", "Owner dependence reduced", "Valued and marketed", "Sale completed"],
  },
  {
    key: "business-side-to-full-time",
    title: "Take your side business full-time",
    summary: "The transition point — replacing a salary without gambling everything.",
    category: "business",
    difficulty: 4,
    weeks: 44,
    tags: ["side hustle", "full time", "transition", "quit job"],
    skills: ["Revenue reliability", "Runway calculation", "Capacity planning", "Risk management", "Timing the jump"],
    milestones: ["Revenue target set", "Six months of runway saved", "Revenue consistently at target", "Gone full-time"],
  },
];

export const business: TemplateDomain = {
  key: "business",
  label: "Business",
  blurb: "Starting, running, growing and eventually leaving a business.",
  templates: [...generated, ...extras],
};
