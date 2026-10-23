/**
 * LE SCRIPT, ÉCRAN PAR ÉCRAN (tâche V4-3, points 5 et 6) : le texte dit et l'ordre des écrans, avec ce que chaque écran
 * affiche. Montré AVANT la voix : sur la feuille « Votre vidéo » (script validé du cas) et sur la fiche vidéo (script
 * écrit qui attend la validation de Will). Aucun style nouveau : les listes de la feuille.
 */
import type { EcranApercu } from "@/moteurs/montage-cas-concret/script-valide";

export function ScriptEcrans({ ecrans }: { ecrans: readonly EcranApercu[] }) {
  return (
    <ol className="space-y-2 text-[15px] text-texte">
      {ecrans.map((e) => (
        <li key={e.rang} className="flex gap-2">
          <span className="w-6 shrink-0 text-right tabular-nums text-texte-faible">{e.rang}.</span>
          <span>
            <span className="text-sm font-semibold text-texte-doux">{e.nom}</span> · « {e.texteDit} »
            {e.affiches.length > 0 && <span className="block text-sm text-texte-faible">{"À l'écran : "}{e.affiches.join(" · ")}</span>}
          </span>
        </li>
      ))}
    </ol>
  );
}
