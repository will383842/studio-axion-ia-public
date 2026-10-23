/**
 * ÉCRITURE DU CAS CONCRET sur la fiche vidéo (tâche X9). Reçoit la vue toute faite (`ecritureCasConcret`).
 * - `TexteDitCasConcret` : l'onglet « Sous-titres » tant que les vrais sous-titres ne sont pas faits ; avant l'écriture,
 *   « Le texte arrive après l'écriture » (jamais le brouillon du cas) ; ensuite, le texte réellement dit.
 * - `DetailTechniqueCasConcret` : pli « Détail technique » de l'onglet « Historique » quand une étape a échoué (la
 *   réponse brute d'une écriture refusée), fermé par défaut.
 */
import { EtatVide } from "@/components/ui/EtatVide";
import type { EcritureCasConcretVue } from "@/services/cas-concret-vue";

export const TEXTE_A_VENIR = "Le texte arrive après l'écriture";

export function TexteDitCasConcret({ vue }: { vue: Pick<EcritureCasConcretVue, "texteDit"> }) {
  if (!vue.texteDit) return <EtatVide compact icone="sous-titres" titre={TEXTE_A_VENIR} />;
  return <p className="whitespace-pre-line text-[17px] leading-relaxed text-texte">{vue.texteDit}</p>;
}

export function DetailTechniqueCasConcret({ vue }: { vue: Pick<EcritureCasConcretVue, "detailTechnique"> }) {
  if (!vue.detailTechnique) return null;
  return (
    <details className="mt-4 rounded-carte border border-trait bg-surface-1 px-4 py-3">
      <summary className="min-h-11 cursor-pointer content-center text-sm font-semibold text-texte-doux">Détail technique</summary>
      <pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap break-words text-xs text-texte-doux">{vue.detailTechnique}</pre>
    </details>
  );
}
