"use client";

import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/cn";

/** Note de qualité /100 dans un anneau animé (sauge ≥ 85, ambre ≥ 70, brique en dessous). */
export function AnneauQualite({ note, taille = 56, className }: { note: number; taille?: number; className?: string }) {
  const reduit = useReducedMotion();
  const r = 42;
  const tour = 2 * Math.PI * r;
  const ton = note >= 85 ? "stroke-sauge" : note >= 70 ? "stroke-ambre" : "stroke-brique";
  return (
    <span className={cn("relative inline-grid shrink-0 place-items-center", className)} style={{ width: taille, height: taille }} role="img" aria-label={`Qualité ${note} sur 100`}>
      <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90">
        <circle cx="50" cy="50" r={r} strokeWidth="8" className="fill-none stroke-surface-3" />
        <motion.circle
          cx="50"
          cy="50"
          r={r}
          strokeWidth="8"
          strokeLinecap="round"
          className={cn("fill-none", ton)}
          strokeDasharray={tour}
          initial={{ strokeDashoffset: reduit ? tour * (1 - note / 100) : tour }}
          animate={{ strokeDashoffset: tour * (1 - note / 100) }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>
      <span className="font-titre tabular-nums leading-none text-texte" style={{ fontSize: taille * 0.32 }}>
        {note}
      </span>
    </span>
  );
}
