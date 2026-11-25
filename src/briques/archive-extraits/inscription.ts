/**
 * Archive des vidéos livrées (C3-UT-3.6a) : vidéo éligible, source préférée, visage et texte des plages,
 * report des gestes de Williams. Fonctions PURES : aucun service, aucune date implicite, aucun accès disque.
 * Imports de types seulement (effacés à la compilation).
 */
import type { PlageExtrait } from "../../domaine/archive-extraits";
import type { Piste, Ratio, Sortie, Video } from "../../domaine/types";
import type { Fenetres } from "./fenetres";
import { EPS } from "../../lib/tolerance";

export type PolitiqueSources = "publiees" | "pretes" | "cochees";
export const POLITIQUE_SOURCES_PAR_DEFAUT: PolitiqueSources = "publiees";

export interface ContexteEligibilite {
  politique: PolitiqueSources;
  cochee?: boolean;
  versionEnEssai: boolean;
  sortieDemo: boolean;
  aSousTitres: boolean;
}

export function videoEligible(
  video: Pick<Video, "estDemo" | "statut" | "corbeilleLe" | "etapeEditoriale">,
  c: ContexteEligibilite,
): { eligible: boolean; raison?: string } {
  const refus = (raison: string) => ({ eligible: false, raison });
  if (video.estDemo) return refus("vidéo d'exemple");
  if (video.statut !== "prete") return refus("vidéo pas prête");
  if (video.corbeilleLe) return refus("vidéo à la corbeille");
  if (c.versionEnEssai) return refus("version en essai");
  if (c.sortieDemo) return refus("sortie d'exemple");
  if (!c.aSousTitres) return refus("pas de sous-titres");
  if (c.politique === "publiees" && video.etapeEditoriale !== "publiee") return refus("vidéo pas publiée");
  if (c.politique === "cochees" && c.cochee !== true) return refus("vidéo non cochée");
  return { eligible: true };
}

export interface SourcePreferee {
  sortieId: string;
  fichierId: string;
  ratio: Ratio;
  origine: "master-sans-texte" | "sortie";
  texteIncruste: boolean;
}

export function sourcePreferee(
  pistes: Pick<Piste, "type" | "fichierId" | "ratio">[],
  sorties: Pick<Sortie, "id" | "ratio" | "fichierId">[],
): SourcePreferee | null {
  for (const ratio of ["9:16", "4:5"] as const) {
    const sortie = sorties.find((s) => s.ratio === ratio);
    if (!sortie) continue;
    const master = pistes.find((p) => p.type === "master-sans-texte" && p.ratio === ratio && p.fichierId);
    if (master?.fichierId) {
      return { sortieId: sortie.id, fichierId: master.fichierId, ratio, origine: "master-sans-texte", texteIncruste: false };
    }
    return { sortieId: sortie.id, fichierId: sortie.fichierId, ratio, origine: "sortie", texteIncruste: true };
  }
  return null;
}

export function qualifierPlages(plages: PlageExtrait[], fenetres: Fenetres, texteIncruste: boolean): PlageExtrait[] {
  return plages.map((p) => {
    const q: PlageExtrait = {
      ...p,
      motsCles: [...p.motsCles],
      texteIncruste,
      avecVisage: fenetres.avecVisage.some((i) => p.debutSec < i.finSec && p.finSec > i.debutSec),
    };
    if (fenetres.inconnues && p.etat === "utilisable") {
      q.etat = "a_verifier";
      q.raisonExclusion = "fenetres-inconnues";
    }
    return q;
  });
}

export const SEUIL_RECOUVREMENT = 0.8;

function recouvre(a: PlageExtrait, b: PlageExtrait): boolean {
  const commun = Math.min(a.finSec, b.finSec) - Math.max(a.debutSec, b.debutSec);
  const longue = Math.max(a.finSec - a.debutSec, b.finSec - b.debutSec);
  return longue > 0 && commun / longue >= SEUIL_RECOUVREMENT - EPS;
}

export function reporterGestes(anciennes: PlageExtrait[], nouvelles: PlageExtrait[]): PlageExtrait[] {
  return nouvelles.map((n) => {
    const copie: PlageExtrait = { ...n, motsCles: [...n.motsCles] };
    const ancienne =
      anciennes.find((a) => a.id === n.id) ??
      anciennes.find((a) => a.texte.trim() === n.texte.trim() && recouvre(a, n));
    if (!ancienne) return copie;
    if (ancienne.ecarteeLe) {
      copie.ecarteeLe = ancienne.ecarteeLe;
      if (copie.etat !== "exclue") copie.etat = "ecartee";
    }
    if (ancienne.valideeLe && !ancienne.ecarteeLe && (copie.etat === "a_verifier" || copie.etat === "utilisable")) {
      copie.etat = "utilisable";
      copie.valideeLe = ancienne.valideeLe;
      delete copie.raisonExclusion;
    }
    return copie;
  });
}
