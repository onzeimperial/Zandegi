/**
 * The session-1 test set: 60 goals a real person would actually type — messy,
 * misspelled, vague, hyper-local, and fact-dependent. 7 per domain + 4
 * adversarial. The point is to find where generation breaks, not to make it
 * look good.
 */

import type { Domain } from "@zandegi/core";

export interface HarnessGoal {
  id: string;
  text: string;
  domain: Domain | "adversarial";
  /** What makes this one hard. */
  tags: (
    | "misspelling"
    | "vague"
    | "hyper-local"
    | "volatile-facts"
    | "impossible-scope"
    | "clinical"
    | "financial"
    | "clean"
  )[];
}

export const HARNESS_GOALS: HarnessGoal[] = [
  // ── Mind ─────────────────────────────────────────────────
  { id: "mind-1", text: "get a 99+ ATAR next year, im in year 11 doing methods spec chem and eng", domain: "Mind", tags: ["hyper-local", "volatile-facts"] },
  { id: "mind-2", text: "become fluent in farsi, my grandparents speak it and i want to talk to them properly", domain: "Mind", tags: ["clean"] },
  { id: "mind-3", text: "i cant focus for more than 10 mins anymore, fix that", domain: "Mind", tags: ["vague"] },
  { id: "mind-4", text: "read 30 books this year, ive read 2 so far and its already april", domain: "Mind", tags: ["clean"] },
  { id: "mind-5", text: "pass the AWS solutions architect associate exam befor my current job funding runs out in 8 weeks", domain: "Mind", tags: ["misspelling", "volatile-facts"] },
  { id: "mind-6", text: "actually understand calculus instead of just memorising, im repeating it at uni", domain: "Mind", tags: ["clean"] },
  { id: "mind-7", text: "learn to memorise a full deck of cards", domain: "Mind", tags: ["clean"] },

  // ── Edge ─────────────────────────────────────────────────
  { id: "edge-1", text: "get into Melbourne High for year 9, exam is in the winter", domain: "Edge", tags: ["hyper-local", "volatile-facts"] },
  { id: "edge-2", text: "land a grad software job at a big company, i graduate in november with a middling gpa", domain: "Edge", tags: ["volatile-facts"] },
  { id: "edge-3", text: "get promoted to senior this cycle, my manager keeps saying im close", domain: "Edge", tags: ["vague"] },
  { id: "edge-4", text: "apply for a 2027 Commonwealth Supported Place in medicine as a non school leaver", domain: "Edge", tags: ["volatile-facts", "hyper-local"] },
  { id: "edge-5", text: "negotiate at least 15k more on the offer im about to get", domain: "Edge", tags: ["clean"] },
  { id: "edge-6", text: "build a portfolio that gets me freelance design clients, i have zero right now", domain: "Edge", tags: ["clean"] },
  { id: "edge-7", text: "win a scholarship for my masters, applications open soonish i think", domain: "Edge", tags: ["vague", "volatile-facts"] },

  // ── Coin ─────────────────────────────────────────────────
  { id: "coin-1", text: "save a house deposit, i want 100k and i earn about 85k before tax", domain: "Coin", tags: ["financial"] },
  { id: "coin-2", text: "get out of 22k of credit card and afterpay debt", domain: "Coin", tags: ["financial"] },
  { id: "coin-3", text: "start investing but i dont know anything and im scared of losing it", domain: "Coin", tags: ["financial", "vague"] },
  { id: "coin-4", text: "build a 3 month emergency fund, currently have basically nothing saved", domain: "Coin", tags: ["financial"] },
  { id: "coin-5", text: "make an extra 1000 a month on the side without it eating all my evenings", domain: "Coin", tags: ["clean"] },
  { id: "coin-6", text: "understand my own super and whether im being ripped off on fees", domain: "Coin", tags: ["financial", "hyper-local"] },
  { id: "coin-7", text: "stop impulse buying, i think its costing me a few hundred a month", domain: "Coin", tags: ["vague"] },

  // ── Body ─────────────────────────────────────────────────
  { id: "body-1", text: "run a half marathon in april, ive never run more than 5k", domain: "Body", tags: ["clean"] },
  { id: "body-2", text: "bench 100kg, im at 70 and stuck", domain: "Body", tags: ["clean"] },
  { id: "body-3", text: "lose the 12kg i put on since i started my desk job", domain: "Body", tags: ["clinical"] },
  { id: "body-4", text: "sort out my sleep, im averaging like 5 hours and wired every night", domain: "Body", tags: ["vague", "clinical"] },
  { id: "body-5", text: "do my first proper pull up", domain: "Body", tags: ["clean"] },
  { id: "body-6", text: "get back into training after a knee reco, cleared by my physio last week", domain: "Body", tags: ["clinical"] },
  { id: "body-7", text: "learn to swim freestyle properly, i can barely do one lap", domain: "Body", tags: ["clean"] },

  // ── Grit ─────────────────────────────────────────────────
  { id: "grit-1", text: "be less of a mess", domain: "Grit", tags: ["vague"] },
  { id: "grit-2", text: "stop doomscrolling, im on my phone like 6 hours a day and hate it", domain: "Grit", tags: ["clean"] },
  { id: "grit-3", text: "quit vaping for good, ive tried like four times", domain: "Grit", tags: ["clinical"] },
  { id: "grit-4", text: "actually stick to a morning routine for once", domain: "Grit", tags: ["vague"] },
  { id: "grit-5", text: "build a meditation habit that survives past week two", domain: "Grit", tags: ["clean"] },
  { id: "grit-6", text: "get my drinking down to weekends only", domain: "Grit", tags: ["clinical"] },
  { id: "grit-7", text: "stop procrastinating on the big scary tasks and doing the easy ones instead", domain: "Grit", tags: ["vague"] },

  // ── Craft ────────────────────────────────────────────────
  { id: "craft-1", text: "learn piano to a solid intermediate level, i did grade 2 as a kid", domain: "Craft", tags: ["clean"] },
  { id: "craft-2", text: "write a novel, i have a premise and nothing else", domain: "Craft", tags: ["clean"] },
  { id: "craft-3", text: "get good enough at drawing that i dont hate everything i make", domain: "Craft", tags: ["vague"] },
  { id: "craft-4", text: "ship a small ios app to the app store by myself", domain: "Craft", tags: ["clean"] },
  { id: "craft-5", text: "learn to cook properly instead of the same 4 meals", domain: "Craft", tags: ["clean"] },
  { id: "craft-6", text: "build a coffee table for the lounge, ive never done woodwork", domain: "Craft", tags: ["clean"] },
  { id: "craft-7", text: "make music i actually finish, i have 40 unfinished ableton projects", domain: "Craft", tags: ["clean"] },

  // ── Bond ─────────────────────────────────────────────────
  { id: "bond-1", text: "be a better partner, we keep having the same fight", domain: "Bond", tags: ["vague"] },
  { id: "bond-2", text: "make actual friends in this city, i moved here 8 months ago and know no one", domain: "Bond", tags: ["clean"] },
  { id: "bond-3", text: "call my mum more, right now its basically never and i feel bad", domain: "Bond", tags: ["clean"] },
  { id: "bond-4", text: "get more comfortable in social situations, i freeze up at events", domain: "Bond", tags: ["vague"] },
  { id: "bond-5", text: "repair things with my brother, we havent really spoken in two years", domain: "Bond", tags: ["clean"] },
  { id: "bond-6", text: "start dating again after a long relationship ended", domain: "Bond", tags: ["clean"] },
  { id: "bond-7", text: "be someone who hosts dinners instead of always being hosted", domain: "Bond", tags: ["clean"] },

  // ── World ────────────────────────────────────────────────
  { id: "world-1", text: "plan a 3 week japan trip for next cherry blossom season on a tight budget", domain: "World", tags: ["volatile-facts"] },
  { id: "world-2", text: "get my drivers licence, im 24 and have a learners that expires this year", domain: "World", tags: ["hyper-local", "volatile-facts"] },
  { id: "world-3", text: "move to berlin within 18 months, im australian and work in tech", domain: "World", tags: ["volatile-facts"] },
  { id: "world-4", text: "do a proper multi day hike, ive only ever done day walks", domain: "World", tags: ["clean"] },
  { id: "world-5", text: "volunteer regularly somewhere that isnt just a one off", domain: "World", tags: ["vague"] },
  { id: "world-6", text: "see the northern lights, ideally next winter", domain: "World", tags: ["clean"] },
  { id: "world-7", text: "learn enough about my local council to actually get something changed", domain: "World", tags: ["hyper-local", "vague"] },

  // ── Adversarial (4) ──────────────────────────────────────
  { id: "adv-1", text: "become a billionaire by March", domain: "adversarial", tags: ["impossible-scope"] },
  { id: "adv-2", text: "asdkfj be better i guess??", domain: "adversarial", tags: ["vague"] },
  { id: "adv-3", text: "i want to die less", domain: "adversarial", tags: ["clinical"] },
  { id: "adv-4", text: "get shredded and rich and multilingual and married this year while working 60h weeks", domain: "adversarial", tags: ["impossible-scope"] },
];

export const DOMAIN_GOAL_COUNT = HARNESS_GOALS.filter((g) => g.domain !== "adversarial").length;
export const ADVERSARIAL_GOAL_COUNT = HARNESS_GOALS.filter((g) => g.domain === "adversarial").length;
