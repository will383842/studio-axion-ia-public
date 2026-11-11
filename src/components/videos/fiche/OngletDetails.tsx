import { EnTeteSection } from "@/components/ui/EnTetePage";
import type { ReactNode } from "react";
import { ChiffresVideo, type ChiffreVideo } from "@/components/fabrication/ChiffresVideo";

/** Onglet « Détails » : les coûts (sortis du haut de la fiche), puis Réglages et Historique passés en enfants. */
export function OngletDetails({ couts, children }: { couts: ChiffreVideo[]; children?: ReactNode }) {
  return (
    <div className="space-y-6">
      {couts.length > 0 && (
        <section>
          <EnTeteSection titre="Coûts" />
          <ChiffresVideo chiffres={couts} />
        </section>
      )}
      {children}
    </div>
  );
}
