import { motion } from "framer-motion";
import { ScanSearch, Siren, GitCommitHorizontal, FileOutput } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

interface Feature {
  icon: LucideIcon;
  title: string;
  description: string;
}

const FEATURES: Feature[] = [
  {
    icon: ScanSearch,
    title: "Instant EVTX Parsing",
    description:
      "Windows Event Log files are parsed directly in a Web Worker — evidence never leaves your machine.",
  },
  {
    icon: Siren,
    title: "Suspicious Event Detection",
    description:
      "Automated heuristics surface anomalous logons, privilege escalation, and other indicators for triage.",
  },
  {
    icon: GitCommitHorizontal,
    title: "Investigation Timeline",
    description:
      "Correlate events chronologically across hosts to reconstruct the sequence of an incident.",
  },
  {
    icon: FileOutput,
    title: "One-Click Export",
    description:
      "Export filtered evidence or the full case as CSV or JSON for reporting and chain-of-custody records.",
  },
];

export function FeatureCards() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-16 sm:py-20">
      <div className="mx-auto mb-10 max-w-2xl text-center">
        <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Built for incident responders
        </h2>
        <p className="mt-2 text-muted-foreground">
          A focused toolkit for the moments when you need answers fast.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {FEATURES.map((feature, i) => (
          <motion.div
            key={feature.title}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.4, delay: i * 0.06 }}
          >
            <Card className="h-full transition-colors hover:border-primary/40">
              <CardHeader>
                <span className="mb-2 flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <feature.icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <CardTitle className="text-base">{feature.title}</CardTitle>
                <CardDescription>{feature.description}</CardDescription>
              </CardHeader>
            </Card>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
