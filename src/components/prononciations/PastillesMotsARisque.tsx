"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { Icone } from "@/components/ui";
import { LIBELLES_RAISON, type MotARisque } from "@/domaine/prononciations";
import { cn } from "@/lib/cn";
import { detecterMotsAction, ecouterPrononciationAction } from "./actions";
import { FeuilleAjoutPrononciation } from "./FeuilleAjoutPrononciation";
import { useEcoute } from "./useEcoute";

/**
 * Pastilles « Comment dire Teleos ? » (n° 2) à l'étape Script : les mots à risque du texte (sigles, noms propres, mots
 * anglais, chiffres avec unités, mots rares), ▶ pour entendre comment la voix le dit, un toucher pour l'ajouter.
 * Un mot déjà dans la liste n'est plus proposé. Rien ne s'affiche s'il n'y a rien à vérifier.
 */
export function PastillesMotsARisque({ texte, className }: { texte: string; className?: string }) {
  const [mots, setMots] = useState<MotARisque[]>([]);
  const [cible, setCible] = useState<MotARisque | null>(null);
  const [version, setVersion] = useState(0);
  const ecoute = useEcoute();

  // Détection après une courte pause de frappe (jamais à chaque lettre).
  useEffect(() => {
    if (texte.trim().length < 3) {
      const t0 = setTimeout(() => setMots([]), 0);
      return () => clearTimeout(t0);
    }
    let annule = false;
    const t = setTimeout(async () => {
      const r = await detecterMotsAction(texte);
      if (!annule && r.ok) setMots(r.donnees);
    }, 700);
    return () => {
      annule = true;
      clearTimeout(t);
    };
  }, [texte, version]);

  if (!mots.length && !cible) return null;

  return (
    <section aria-label="Mots à vérifier à l'oreille" className={cn("rounded-carte border border-trait bg-surface-1 p-3", className)}>
      <p className="mb-2 flex items-center gap-2 px-1 text-sm font-semibold text-texte-doux">
        <Icone nom="casque" size={15} className="text-orange-vif" />
        La voix les dira-t-elle bien ?
      </p>
      <ul className="flex flex-wrap gap-2">
        <AnimatePresence initial={false}>
          {mots.map((m) => {
            const cle = `avant|${m.mot}|`;
            return (
              <motion.li key={m.mot} layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="flex items-stretch overflow-hidden rounded-full border border-ambre/30 bg-ambre-doux">
                <button
                  type="button"
                  aria-label={`Écouter « ${m.mot} »`}
                  onClick={() => void ecoute.jouer(cle, () => ecouterPrononciationAction(m.mot, "", "avant"))}
                  className="grid min-h-11 w-11 place-items-center text-ambre transition-colors hover:bg-ambre/10"
                >
                  <Icone nom={ecoute.enCours === cle ? "chargement" : ecoute.joue === cle ? "volume" : "lecture"} size={15} className={cn(ecoute.enCours === cle && "animate-spin")} />
                </button>
                <button type="button" onClick={() => setCible(m)} className="flex min-h-11 items-center gap-1.5 border-l border-ambre/20 pl-2.5 pr-3.5 text-left text-sm text-texte transition-colors hover:bg-ambre/10">
                  <span>
                    Comment dire <span className="font-semibold">« {m.mot} »</span> ?
                  </span>
                  <span className="sr-only">({LIBELLES_RAISON[m.raison]})</span>
                  <Icone nom="plus" size={14} className="text-ambre" />
                </button>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>
      <FeuilleAjoutPrononciation
        ouverte={!!cible}
        onOuverteChange={(o) => !o && setCible(null)}
        initial={cible ? { mot: cible.mot, suggestion: cible.suggestion } : undefined}
        source="script"
        onEnregistree={(r) => {
          setMots((l) => l.filter((x) => x.mot !== r.mot));
          setVersion((v) => v + 1);
        }}
      />
    </section>
  );
}
