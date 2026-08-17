import { getAllRules } from "@/lib/detection/registry";
import { useHydrateRuleConfigStore, useRuleConfigStore } from "@/store/ruleConfigStore";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

/**
 * Settings — Detection Rules panel (Phase 5 Item 2, SDD §7 Nice to Have:
 * "Configurable/extensible detection rule set (e.g. a rules panel to
 * enable/disable individual heuristics)"). Deliberately not wrapped in
 * `CaseStateGate`, same reasoning as `CasesPage.tsx`: which rules run is a
 * global, cross-case preference (like the theme choice), not data about
 * whichever case (if any) happens to be loaded right now, so this page is
 * always available regardless of `evidenceStore`'s state.
 *
 * Toggling a rule here does not re-run detection on a case that's already
 * loaded — `runDetectionEngine` is invoked once per file load (see
 * `evidenceStore.ts`'s own doc comment on that), and reactively re-running
 * it on every checkbox click was explicitly out of this item's minimal,
 * architecture-compatible scope. The change takes effect the next time a
 * case is loaded, which the description below states plainly rather than
 * leaving an investigator to guess.
 */
export default function SettingsPage() {
  useHydrateRuleConfigStore();

  const rules = getAllRules();
  const enabledByRuleId = useRuleConfigStore((s) => s.enabledByRuleId);
  const setRuleEnabled = useRuleConfigStore((s) => s.setRuleEnabled);
  const resetToDefaults = useRuleConfigStore((s) => s.resetToDefaults);

  const enabledCount = rules.filter((rule) => enabledByRuleId[rule.id] ?? true).length;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Settings"
        description="Configure which detection rules run against loaded evidence."
      />

      <Card>
        <CardContent className="flex flex-col gap-4 p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Detection Rules</h2>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                {enabledCount} of {rules.length} rules enabled. A disabled rule stops producing
                findings the next time you load a case — it does not change the case currently open.
                Every rule's own detection logic, severity, and scoring are unchanged; disabling one
                only decides whether it participates.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={resetToDefaults} className="shrink-0">
              Reset to Defaults
            </Button>
          </div>

          <ul className="divide-y divide-border">
            {rules.map((rule) => {
              const enabled = enabledByRuleId[rule.id] ?? true;
              const checkboxId = `rule-enabled-${rule.id}`;
              const descriptionId = `rule-description-${rule.id}`;
              return (
                <li key={rule.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                  <Checkbox
                    id={checkboxId}
                    checked={enabled}
                    onCheckedChange={(value) => setRuleEnabled(rule.id, value === true)}
                    aria-describedby={descriptionId}
                    className="mt-0.5"
                  />
                  <div className="min-w-0 flex-1">
                    <label
                      htmlFor={checkboxId}
                      className="cursor-pointer text-sm font-medium text-foreground"
                    >
                      {rule.name}
                    </label>
                    <p id={descriptionId} className="mt-0.5 text-sm text-muted-foreground">
                      {rule.description}
                    </p>
                  </div>
                  <Badge variant={enabled ? "success" : "outline"} className="mt-0.5 shrink-0">
                    {enabled ? "Enabled" : "Disabled"}
                  </Badge>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
