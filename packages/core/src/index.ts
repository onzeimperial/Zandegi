/**
 * @zandegi/core
 *
 * Pure domain logic: types, guards, and the deterministic scoring primitives
 * that govern XP, levels, rank, and rarity. NO I/O, NO framework imports.
 * Every scored number in Zandegi comes from here, not from the model
 * (CLAUDE.md §2.5).
 */

export * from "./domains";
export * from "./goal-types";
export * from "./verification";
export * from "./safety";
export * from "./scoring/xp";
export * from "./scoring/levels";
export * from "./scoring/rarity";
