import type { TemplateDomain, TemplateSpec } from "../types";

interface Craft {
  slug: string;
  name: string;
  /** The technique that separates competent from amateur. */
  technique: string;
  /** First real finished object. */
  firstProject: string;
  hard?: boolean;
}

const CRAFTS: Craft[] = [
  { slug: "woodworking", name: "woodworking", technique: "Accurate marking and joinery", firstProject: "A joined box or small table" },
  { slug: "carpentry", name: "carpentry", technique: "Measuring and structural fixing", firstProject: "A built-in shelf or frame" },
  { slug: "wood-carving", name: "wood carving", technique: "Grain reading and tool control", firstProject: "A carved spoon or figure" },
  { slug: "furniture-making", name: "furniture making", technique: "Joinery and finishing", firstProject: "A chair or cabinet", hard: true },
  { slug: "welding", name: "welding", technique: "Bead consistency and penetration", firstProject: "A welded frame", hard: true },
  { slug: "blacksmithing", name: "blacksmithing", technique: "Heat control and hammer accuracy", firstProject: "A forged hook or knife", hard: true },
  { slug: "knife-making", name: "knife making", technique: "Grinding and heat treatment", firstProject: "A finished usable knife", hard: true },
  { slug: "leatherwork", name: "leatherwork", technique: "Saddle stitching and edge finishing", firstProject: "A wallet or belt" },
  { slug: "sewing", name: "sewing", technique: "Accurate seams and pattern reading", firstProject: "A garment you would wear" },
  { slug: "dressmaking", name: "dressmaking", technique: "Fitting and pattern adjustment", firstProject: "A well-fitted dress", hard: true },
  { slug: "tailoring", name: "tailoring", technique: "Fit and structure", firstProject: "An altered jacket that fits", hard: true },
  { slug: "knitting", name: "knitting", technique: "Even tension", firstProject: "A finished jumper" },
  { slug: "crochet", name: "crochet", technique: "Consistent tension and stitch counting", firstProject: "A finished blanket or garment" },
  { slug: "embroidery", name: "embroidery", technique: "Stitch consistency", firstProject: "A finished hooped piece" },
  { slug: "weaving", name: "weaving", technique: "Warp tension", firstProject: "A woven cloth or wall hanging" },
  { slug: "quilting", name: "quilting", technique: "Accurate piecing", firstProject: "A finished quilt" },
  { slug: "pottery", name: "pottery", technique: "Centring on the wheel", firstProject: "A set of matching bowls", hard: true },
  { slug: "ceramics-handbuilding", name: "hand-built ceramics", technique: "Even walls and joins", firstProject: "A hand-built vessel" },
  { slug: "glassblowing", name: "glassblowing", technique: "Heat and gravity control", firstProject: "A blown vessel", hard: true },
  { slug: "stained-glass", name: "stained glass", technique: "Accurate cutting and soldering", firstProject: "A stained glass panel" },
  { slug: "jewellery", name: "jewellery making", technique: "Soldering and finishing", firstProject: "A finished ring or pendant" },
  { slug: "silversmithing", name: "silversmithing", technique: "Forming and soldering", firstProject: "A silver piece you would wear", hard: true },
  { slug: "bookbinding", name: "bookbinding", technique: "Square, tight sewing", firstProject: "A hand-bound book" },
  { slug: "candle-making", name: "candle making", technique: "Wick and temperature control", firstProject: "Candles that burn cleanly" },
  { slug: "soap-making", name: "soap making", technique: "Safe lye handling and trace", firstProject: "A cured batch of soap" },
  { slug: "electronics", name: "electronics", technique: "Circuit reasoning and soldering", firstProject: "A working custom circuit" },
  { slug: "arduino", name: "microcontroller projects", technique: "Wiring and embedded code", firstProject: "A working sensor project" },
  { slug: "3d-printing", name: "3D printing", technique: "Slicing and first-layer control", firstProject: "A printed part that fits and works" },
  { slug: "cnc", name: "CNC machining", technique: "Toolpaths and workholding", firstProject: "A machined part to tolerance", hard: true },
  { slug: "model-making", name: "model making", technique: "Patience and fine finishing", firstProject: "A finished painted model" },
  { slug: "car-mechanics", name: "car mechanics", technique: "Systematic diagnosis", firstProject: "A repair done yourself", hard: true },
  { slug: "bike-mechanics", name: "bike maintenance", technique: "Adjustment and truing", firstProject: "A fully serviced bike" },
  { slug: "upholstery", name: "upholstery", technique: "Stretching and stapling evenly", firstProject: "A reupholstered chair" },
  { slug: "restoration", name: "furniture restoration", technique: "Stripping and finishing", firstProject: "A restored piece of furniture" },
];

function learnCraft(c: Craft): TemplateSpec {
  return {
    key: `making-${c.slug}`,
    title: `Learn ${c.name}`,
    summary: `Pick up ${c.name} properly, starting with the skill that decides whether the result looks handmade or homemade: ${c.technique.toLowerCase()}.`,
    category: "creative",
    difficulty: c.hard ? 4 : 3,
    weeks: c.hard ? 32 : 20,
    tags: [c.slug.replace(/-/g, " "), c.name, "craft", "making", "hands-on"],
    skills: ["Tools and safety", c.technique, "Working to a plan", "Finishing well", "Fixing mistakes"],
    milestones: ["Tools set up and safe", "First practice pieces done", c.firstProject, "A piece good enough to give away"],
  };
}

const generated = CRAFTS.map(learnCraft);

const extras: TemplateSpec[] = [
  {
    key: "making-diy-basics",
    title: "Learn basic DIY and home repair",
    summary: "Stop paying someone for jobs you could do in an afternoon.",
    category: "general",
    difficulty: 2,
    weeks: 16,
    tags: ["diy", "home repair", "tools", "maintenance"],
    skills: ["Tool basics", "Fixing to walls", "Basic plumbing repairs", "Basic electrical safety", "Painting and filling"],
    milestones: ["Toolkit assembled", "First repair completed", "Five jobs done yourself", "Confident tackling unfamiliar jobs"],
  },
  {
    key: "making-renovate-room",
    title: "Renovate a room yourself",
    summary: "Plan, budget and execute a full room renovation without it dragging on for a year.",
    category: "project",
    difficulty: 4,
    weeks: 24,
    tags: ["renovation", "diy", "home", "project"],
    skills: ["Scoping and budgeting", "Sequencing trades and tasks", "Surface preparation", "Finishing work", "Snagging"],
    milestones: ["Plan and budget agreed", "Strip-out complete", "Main work complete", "Snagged and finished"],
  },
  {
    key: "making-build-pc",
    title: "Build your own computer",
    summary: "Choose compatible parts and assemble a machine that boots first time.",
    category: "project",
    difficulty: 2,
    weeks: 6,
    tags: ["pc build", "computer", "hardware", "diy"],
    skills: ["Part compatibility", "Assembly and cable management", "BIOS and OS setup", "Troubleshooting"],
    milestones: ["Parts list finalised", "Assembled", "Boots and posts", "Fully set up and stable"],
  },
  {
    key: "making-restore-bike",
    title: "Restore an old bicycle",
    summary: "Take a neglected bike back to genuinely rideable condition.",
    category: "project",
    difficulty: 3,
    weeks: 12,
    tags: ["bike", "restoration", "mechanics", "diy"],
    skills: ["Assessment and stripping", "Bearing service", "Drivetrain and brakes", "Finishing and adjustment"],
    milestones: ["Stripped and assessed", "Bearings and drivetrain serviced", "Reassembled", "Ridden and dialled in"],
  },
  {
    key: "making-workshop-setup",
    title: "Set up a home workshop",
    summary: "A safe, organised space that makes projects likely instead of aspirational.",
    category: "project",
    difficulty: 2,
    weeks: 12,
    tags: ["workshop", "garage", "tools", "organisation"],
    skills: ["Space planning", "Tool selection", "Storage systems", "Dust and safety"],
    milestones: ["Space cleared and planned", "Bench and power sorted", "Tools stored and findable", "First project built in it"],
  },
  {
    key: "making-sell-crafts",
    title: "Sell what you make",
    summary: "Turn a craft into a small income without it stopping being enjoyable.",
    category: "business",
    difficulty: 3,
    weeks: 28,
    tags: ["etsy", "craft business", "selling", "market"],
    skills: ["Product and pricing", "Photography and listings", "Packaging and shipping", "Marketing", "Batch production"],
    milestones: ["Products and pricing set", "Shop or stall live", "First ten sales", "Consistent monthly sales"],
  },
];

export const making: TemplateDomain = {
  key: "making",
  label: "Making & craft",
  blurb: "Woodwork, textiles, metal, ceramics, electronics and fixing things yourself.",
  templates: [...generated, ...extras],
};
