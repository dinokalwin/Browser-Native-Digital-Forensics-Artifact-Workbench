/**
 * IOC Detection Engine — rule registry (Phase 5.4).
 *
 * The single place that knows the full list of registered rules. Adding,
 * removing, or reordering a rule means editing `rules/index.ts` only —
 * `engine.ts` never imports an individual rule file directly, so it can't
 * accidentally skip one.
 */
import type { DetectionRule } from "./types";
import { rules } from "./rules";

/** Every registered detection rule. Registration order here is just a
 * stable, readable default — `engine.ts` sorts the resulting *findings* by
 * severity afterward, so this order has no visible effect on output. */
export function getAllRules(): DetectionRule[] {
  return rules;
}

export function getRuleById(id: string): DetectionRule | undefined {
  return rules.find((rule) => rule.id === id);
}
