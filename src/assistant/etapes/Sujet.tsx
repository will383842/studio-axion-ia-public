"use client";

import { motion } from "motion/react";
import { Champ } from "@/components/ui/Champ";
import { Icone } from "@/components/ui/Icone";
import { FormeRatio, SelecteurPastilles } from "@/components/ui/SelecteurPastilles";
import type { Ratio } from "@/domaine/types";
import { dureeDepuisScript, libelleDuree, obtenirFormat, valeursDuree } from "@/formats";
import type { ProprietesEtape } from "./types";

const USAGES: Record<Ratio, string> = { "9:16": "TikTok, Reels, LinkedIn", "1:1": "LinkedIn", "4:5": "Instagram", "16:9": "YouTube" };

/** Étape « sujet » : sujet (ou une idée en un geste) + durée + formats d'image, en pastilles venant du format. */
export function EtapeSujet({ formatId, brouillon, modifier, contexte }: ProprietesEtape) {
  const format = obtenirFormat(formatId);
  const idees = contexte.idees.filter((i) => i.texte !== brouillon.sujet).slice(0, 4);
  return (
    <div className="space-y-8">
      <div>
        <Champ
          libelle="Le sujet"
          grand
          autoFocus={!brouillon.sujet}
          placeholder="Relancer automatiquement les devis qui dorment"
          value={brouillon.sujet}
          maxLength={160}
          onChange={(e) => modifier({ sujet: e.target.value, titre: "" })}
        />
        {idees.length > 0 && (
          <div className="sans-barre -mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1">
            {idees.map((i, n) => (
              <motion.button
                key={i.id}
                type="button"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 * n }}
                onClick={() => modifier({ sujet: i.texte, titre: "" })}
                className="flex min-h-11 max-w-[78%] shrink-0 items-center gap-2 rounded-full border border-trait bg-surface-1 px-4 text-left text-sm font-semibold text-texte-doux transition-colors hover:border-ambre/60 hover:text-texte sm:max-w-xs"
              >
                <Icone nom="idee" size={15} className="shrink-0 text-ambre" />
                <span className="truncate">{i.texte}</span>
              </motion.button>
            ))}
          </div>
        )}
      </div>
      {/* Format « depuis-script » : aucune pastille, c'est le texte qui fixe la durée (B.0 §18). */}
      {!dureeDepuisScript(format) && (
        <SelecteurPastilles
          libelle="Durée"
          taille="lg"
          defilement
          options={valeursDuree(format).map((s) => ({ valeur: s, libelle: libelleDuree(s) }))}
          valeur={brouillon.dureeCibleSec}
          onChange={(v) => modifier({ dureeCibleSec: v })}
        />
      )}
      <SelecteurPastilles
        libelle="Formats d'image"
        multiple
        minimum={1}
        taille="lg"
        options={format.ratios.map((r) => ({ valeur: r, libelle: r, detail: USAGES[r], visuel: <FormeRatio ratio={r} /> }))}
        valeur={brouillon.ratios}
        onChange={(v) => modifier({ ratios: v })}
      />
    </div>
  );
}
