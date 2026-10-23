/**
 * LA FICHE DU TABLEAU ANIMÉ SUR « VOTRE VIDÉO » (raccord 1) : les vidéos fabriquées (une par format, avec leurs réseaux
 * et leur téléchargement), la fiche de scènes et ses refus, le coût de la voix et les boutons de retouche. Reçoit la vue
 * toute faite (`vueTableau`) ; une erreur est dite en une phrase simple.
 */
import { Icone } from "@/components/ui/Icone";
import type { VueTableau } from "@/services/tableau-vue";
import { FicheScenesTableau } from "./FicheScenes";
import { RetouchesTableau } from "./RetouchesTableau";
import { SortiesTableau } from "./SortiesTableau";

export function VotreFicheTableau({ videoId, vue, possible }: { videoId: string; vue: VueTableau; possible: boolean }) {
  if (!vue.fiche)
    return (
      <div className="mt-6 space-y-4">
        <SortiesTableau sorties={vue.sorties ?? []} />
        <p role="alert" className="flex items-start gap-2 rounded-xl border border-brique/40 bg-fond px-3 py-2 text-[15px] text-texte">
          <Icone nom="attention" size={16} className="mt-0.5 shrink-0 text-brique" />
          <span className="min-w-0">{vue.erreur ?? "La fiche de scènes de cette vidéo est introuvable."}</span>
        </p>
      </div>
    );
  return (
    <div className="mt-6 space-y-4">
      <SortiesTableau sorties={vue.sorties ?? []} />
      <FicheScenesTableau fiche={vue.fiche} problemes={vue.problemes} />
      <RetouchesTableau videoId={videoId} retouches={vue.retouches} choix={vue.choix} coutCentimes={vue.coutCentimes} possible={possible} />
    </div>
  );
}
