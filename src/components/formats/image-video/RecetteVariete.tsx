"use client";

/**
 * ÉCRAN 3 · LA RECETTE DE LA VIDÉO (lot F, variété) : la façon de montrer tirée pour cette vidéo, axe par axe, en
 * libellés (jamais un code). Will peut changer un axe avant de payer la voix ; le déroulé, déjà dans le script, est
 * seulement montré. Chaque réseau reçoit ensuite son ouverture et son format (le fil Facebook en 4:5 ; LinkedIn en 9:16).
 */
import type { RecetteVarieteIV } from "@/briques/schema-motion/variete";
import { Carte } from "@/components/ui/Carte";
import type { LigneVarieteIV } from "./vue";

export function RecetteVariete({ lignes, onChanger }: { lignes: LigneVarieteIV[]; onChanger: (axe: keyof RecetteVarieteIV, code: string) => void }) {
  return (
    <Carte className="space-y-2">
      <p className="text-sm font-semibold text-texte-doux">La façon de montrer</p>
      <dl className="grid gap-x-4 gap-y-2 sm:grid-cols-2">
        {lignes.map((l) => (
          <div key={l.axe} className="flex min-h-11 items-center justify-between gap-3 rounded-carte bg-surface-1 px-3 py-1.5">
            <dt className="text-sm text-texte-doux">{l.nom}</dt>
            <dd className="text-right text-[15px] text-texte">
              {l.modifiable && l.choix.length ? (
                <select aria-label={l.nom} value={l.code} onChange={(e) => onChanger(l.axe, e.target.value)} className="min-h-9 rounded-carte border border-trait bg-surface-2 px-2 text-[15px] text-texte">
                  {l.choix.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.libelle}
                    </option>
                  ))}
                </select>
              ) : (
                <span>
                  {l.libelle}
                  {!l.modifiable && <span className="ml-1 text-sm text-texte-faible">(dans le script)</span>}
                </span>
              )}
            </dd>
          </div>
        ))}
      </dl>
    </Carte>
  );
}
