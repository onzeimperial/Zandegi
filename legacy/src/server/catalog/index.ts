import type { TemplateDomain, TemplateSpec } from "./types";

import { fitness } from "./templates/fitness";
import { language } from "./templates/language";
import { music } from "./templates/music";
import { tech } from "./templates/tech";
import { sport } from "./templates/sport";
import { career } from "./templates/career";
import { academic } from "./templates/academic";
import { creative } from "./templates/creative";
import { food } from "./templates/food";
import { making } from "./templates/making";
import { money } from "./templates/money";
import { wellbeing } from "./templates/wellbeing";
import { life } from "./templates/life";
import { travel } from "./templates/travel";
import { outdoors } from "./templates/outdoors";
import { hobbies } from "./templates/hobbies";
import { business } from "./templates/business";
import { people } from "./templates/people";
import { growth } from "./templates/growth";
import { world } from "./templates/world";
import { strength } from "./templates/strength";
import { practical } from "./templates/practical";
import { challenges } from "./templates/challenges";

/**
 * The global goal catalogue. Add a domain by creating a file under
 * ./templates and listing it here — test/catalog.test.ts enforces unique
 * keys and valid shapes across every domain.
 */
export const DOMAINS: TemplateDomain[] = [
  fitness,
  language,
  music,
  tech,
  sport,
  career,
  academic,
  creative,
  food,
  making,
  money,
  wellbeing,
  life,
  travel,
  outdoors,
  hobbies,
  business,
  people,
  growth,
  world,
  strength,
  practical,
  challenges,
];

export const ALL_TEMPLATES: TemplateSpec[] = DOMAINS.flatMap((d) => d.templates);

export const TEMPLATE_BY_KEY = new Map(ALL_TEMPLATES.map((t) => [t.key, t]));

/** Domain key for a given template, for browse grouping and DB rows. */
export const DOMAIN_OF = new Map(
  DOMAINS.flatMap((d) => d.templates.map((t) => [t.key, d.key] as const)),
);

export type { TemplateDomain, TemplateSpec };
