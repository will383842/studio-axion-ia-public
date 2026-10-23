import { ETAPES_EDITORIALES, STATUTS_PREPARATION, STATUTS_TRAVAIL, STATUTS_VIDEO } from "@/domaine/libelles";
import type { EtapeEditoriale, StatutPreparation, StatutTravail, StatutVideo } from "@/domaine/types";
import { Pastille } from "./Pastille";

type Proprietes =
  | { type: "video"; statut: StatutVideo; className?: string }
  | { type: "editorial"; statut: EtapeEditoriale; className?: string }
  | { type: "travail"; statut: StatutTravail; className?: string }
  | { type: "preparation"; statut: StatutPreparation; className?: string };

/** État d'une vidéo (technique ou éditorial), d'un travail ou d'une préparation. */
export function PastilleEtat(p: Proprietes) {
  if (p.type === "video") {
    const s = STATUTS_VIDEO[p.statut];
    return (
      <Pastille ton={s.tonalite} point={p.statut === "en_fabrication" || p.statut === "en_file"} className={p.className}>
        {s.libelle}
      </Pastille>
    );
  }
  if (p.type === "editorial") {
    const s = ETAPES_EDITORIALES[p.statut];
    return (
      <Pastille ton={s.tonalite} icone={s.icone} className={p.className}>
        {s.libelle}
      </Pastille>
    );
  }
  const s = p.type === "travail" ? STATUTS_TRAVAIL[p.statut] : STATUTS_PREPARATION[p.statut];
  return (
    <Pastille ton={s.tonalite} point={p.statut === "en_cours" || p.statut === "en_preparation"} className={p.className}>
      {s.libelle}
    </Pastille>
  );
}
