// T-EXT-27 : adaptateur du regardeur COMMUN (`@/briques/regardeur`) au tutoriel d'outil. PUR : aucun appel, aucun disque ; 0 €.
// Il ne définit ni rôle, ni consigne, ni schéma : tout vient de la brique commune (Claude recopie, le code juge).
// L'appel payant (tirage des images, `roleRegard`) est branché par la fiche 27b, pas ici.
import { choisirInstants, jugerRegard } from "@/briques/regardeur";
import type { FinAttendue, InstantRegard, LectureRegard, VerdictRegard } from "@/briques/regardeur";
import type { PlanValide } from "@/briques/plan-scenes/schema";
import type { RegistreTextes } from "./registre-textes";

/** Plafond d'images du tutoriel (≤ `IMAGES_REGARD_MAX`) : borne le coût. */
export const IMAGES_REGARD_TUTORIEL = 12;

/** Instants à regarder : le début (0,5 s), un par scène, la fin. Déterministe, au plus 12. */
export function instantsTutoriel(plan: PlanValide, e: { finMs: number; registre?: RegistreTextes }): InstantRegard[] {
  const finSec = Number.isFinite(e?.finMs) && e.finMs > 0 ? e.finMs / 1000 : 0;
  const porteurs = new Set((e.registre?.entrees ?? []).filter((x) => x.choisi && x.ou !== "voix" && x.etapeId).map((x) => x.etapeId));
  return choisirInstants(
    {
      parties: plan.scenes.map((s) => ({ id: s.id, debutSec: s.debutMs / 1000, finSec: s.finMs / 1000, texteAttendu: porteurs.has(s.id) })),
      dureeSec: plan.dureeMs / 1000 + finSec,
      mots: plan.mots.map((m) => ({ mot: m.texte, debutSec: m.debutMs / 1000, finSec: m.finMs / 1000 })),
    },
    IMAGES_REGARD_TUTORIEL,
  );
}

/** Textes permis à l'écran : ceux du registre que l'utilisateur a choisis. */
export function textesPermisDuRegistre(registre: RegistreTextes): string[] {
  return registre.entrees.filter((x) => x.choisi).map((x) => x.texte);
}

/** `jugerRegard` de la brique commune, rien d'autre. Lecture absente ou illisible : instants « non relus », jamais un passage par défaut. */
export function verdictRegardTutoriel(instants: InstantRegard[], lecture: LectureRegard | null, e: { textesPermis: string[]; fin?: FinAttendue }): VerdictRegard {
  return jugerRegard({ instants, lecture, textesPermis: e.textesPermis, fin: e.fin });
}
