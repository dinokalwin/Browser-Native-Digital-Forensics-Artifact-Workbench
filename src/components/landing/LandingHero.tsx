import { motion } from "framer-motion";
import { ShieldCheck } from "lucide-react";

import { DropZone } from "@/components/upload/DropZone";
import { Badge } from "@/components/ui/badge";

export function LandingHero() {
  return (
    <section className="relative overflow-hidden bg-grid bg-radial-fade">
      <div className="mx-auto flex max-w-4xl flex-col items-center px-4 py-20 text-center sm:py-28">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <Badge
            variant="outline"
            className="mb-6 gap-1.5 border-primary/30 px-3 py-1 text-primary"
          >
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            Browser-native · No upload to a server
          </Badge>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.05 }}
          className="text-balance text-4xl font-semibold tracking-tight text-foreground sm:text-5xl"
        >
          Digital Forensics Artifact Workbench
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="mt-4 max-w-2xl text-balance text-base text-muted-foreground sm:text-lg"
        >
          Parse, triage, and investigate Windows Event Log (EVTX) artifacts
          entirely in your browser. No installs, no uploads — your evidence
          never leaves the machine.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="mt-10 w-full"
        >
          <DropZone />
        </motion.div>
      </div>
    </section>
  );
}
