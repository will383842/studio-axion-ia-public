"use client";

import { motion } from "motion/react";
import { Icone, type NomIcone } from "@/components/ui/Icone";
import { cn } from "@/lib/cn";
import { type CleAvantDePublier, useVideo } from "./ContexteVideo";

const CASES: { cle: CleAvantDePublier; libelle: string; icone: NomIcone }[] = [
  { cle: "image", libelle: "Image", icone: "image" },
  { cle: "son", libelle: "Son", icone: "volume" },
  { cle: "sousTitres", libelle: "Sous-titres", icone: "sous-titres" },
  { cle: "mentionIA", libelle: "Mention IA", icone: "etincelles" },
  { cle: "droits", libelle: "Droits", icone: "bouclier" },
];

/**
 * « Avant de publier » (AV2.3-13) : 5 cases, en partie précochées par le rapport de qualité ; 4 quand la
 * mention IA est coupée (décision de Will du 01/10, jamais bloquant). Le bouton Publier s'active quand
 * toutes les cases affichées sont cochées (et qu'aucune licence ne bloque).
 * Ordre permanent de Will : RIEN sur l'étiquette ou la mention IA à l'écran, sauf la case quand Will l'a allumée.
 */
export function AvantDePublier() {
  const { cases, cocher, nbCochees, verifiesAuto, kit, casesRequises } = useVideo();
  if (!cases) return null;
  const visibles = CASES.filter((x) => casesRequises.includes(x.cle));
  const total = visibles.length;
  const complet = nbCochees === total;
  const r = 20;
  const c = 2 * Math.PI * r;
  return (
    <section aria-labelledby="avant-publier" className={cn("relative isolate overflow-hidden rounded-carte border p-4 sm:p-5", complet ? "border-sauge/40 bg-sauge-doux" : "border-trait bg-surface-1")}>
      <div className="mb-3 flex items-center gap-3">
        <div className="relative size-12 shrink-0">
          <svg viewBox="0 0 48 48" className="size-full -rotate-90" aria-hidden>
            <circle cx="24" cy="24" r={r} className="fill-none stroke-surface-3" strokeWidth="5" />
            <motion.circle
              cx="24"
              cy="24"
              r={r}
              className={cn("fill-none stroke-current", complet ? "text-sauge" : "text-orange-vif")}
              strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray={c}
              // Valeur de départ explicite : sans elle, motion anime depuis « undefined » (avertissement console).
              initial={{ strokeDashoffset: c - (nbCochees / total) * c }}
              animate={{ strokeDashoffset: c - (nbCochees / total) * c }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            />
          </svg>
          <span className="absolute inset-0 grid place-items-center font-titre text-sm tabular-nums text-texte">{complet ? <Icone nom="coche" size={18} className="text-sauge" strokeWidth={3} /> : `${nbCochees}/${total}`}</span>
        </div>
        <div className="min-w-0">
          <h2 id="avant-publier" className="text-lg text-texte">
            Avant de publier
          </h2>
          <p className="text-sm text-texte-doux">{complet ? "Tout est vérifié." : "Cochez ce que vous avez vérifié."}</p>
        </div>
      </div>
      <ul className={cn("grid gap-1.5", total === 4 ? "grid-cols-4" : "grid-cols-5")}>
        {visibles.map((x) => {
          const coche = cases[x.cle];
          const bloqueDroits = x.cle === "droits" && (kit?.licencesABloquer.length ?? 0) > 0;
          return (
            <li key={x.cle}>
              <button
                type="button"
                role="checkbox"
                aria-checked={coche}
                onClick={() => cocher(x.cle, !coche)}
                title={verifiesAuto[x.cle] ? "Vérifié par le contrôle de qualité" : undefined}
                className={cn(
                  "relative flex min-h-[76px] w-full flex-col items-center justify-center gap-1.5 rounded-2xl border px-1 text-center transition-colors duration-200",
                  coche ? "border-orange bg-orange text-sur-orange" : "border-trait bg-surface-2 text-texte-doux hover:border-trait-fort hover:text-texte",
                )}
              >
                <motion.span key={String(coche)} initial={{ scale: 0.7 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 500, damping: 22 }}>
                  <Icone nom={coche ? "coche" : x.icone} size={20} strokeWidth={coche ? 3 : 2} />
                </motion.span>
                <span className="text-[11px] font-bold leading-tight">{x.libelle}</span>
                {verifiesAuto[x.cle] && !coche && <span aria-hidden className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-sauge" />}
                {bloqueDroits && <span aria-hidden className="absolute right-1.5 top-1.5 size-2 rounded-full bg-ambre" />}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
