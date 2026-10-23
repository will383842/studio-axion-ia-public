/**
 * VIDÉOS D'ILLUSTRATION DES PLAQUETTES v4 — garde-fou PUR (18/10/2026).
 *
 * Cause du plantage de la vidéo v-60359dd080b1 : trois plaquettes (AvantApres, MosaiqueVideos, duel-video) montrent des VIDÉOS (champ
 * `videos` de leur fiche) ; le réalisateur écrit des `recherches`, mais personne ne remplissait `medias`. Le rendu demandait alors un
 * fichier sans nom (`broll/`) et mourait à 99 %.
 * Décision de Will (18/10) : quand aucune vidéo littérale n'est trouvée, la plaquette est RETIRÉE du plan (le visage reste seul à cet
 * instant), jamais remplacée par une vidéo approximative. Ces fonctions ne touchent à rien d'autre.
 */
import type { ElementV4Plan } from "@/domaine/facecam-animee/plan";
import { ficheV4 } from "./realisateur/catalogue-v4";

/** Plan minimal que ces fonctions lisent (un plan entier convient). */
export type PlanAvecElementsV4 = { elementsV4?: ElementV4Plan[] };

/** Nombre de vidéos [min, max] exigé par la fiche d'une plaquette ; `null` : elle n'en montre pas. */
export function besoinVideosV4(id: string): readonly [number, number] | null {
  const f = ficheV4(id);
  if (!f || !f.actif) return null;
  return f.videos[1] > 0 ? f.videos : null;
}

/** Clés de vidéos réellement présentes (les clés vides ne comptent pas). */
const clesPresentes = (e: ElementV4Plan): string[] => (e.medias ?? []).filter((m) => typeof m === "string" && m.trim() !== "");

/** Pourquoi la plaquette n'a pas ses vidéos ; `null` : elle les a (ou n'en exige pas). PUR. */
export function raisonSansVideoV4(e: ElementV4Plan): string | null {
  const besoin = besoinVideosV4(e.id);
  if (!besoin) return null;
  const presentes = clesPresentes(e);
  const demandees = e.recherches?.length ?? 0;
  if (!presentes.length) return `aucune vidéo trouvée pour « ${e.id} »`;
  if (presentes.length < besoin[0]) return `${presentes.length} vidéo(s) trouvée(s) sur ${besoin[0]} au minimum pour « ${e.id} »`;
  // Une vidéo manquante ferait doubler une autre (le rendu reprend la première) : jamais.
  if (presentes.length < demandees) return `${presentes.length} vidéo(s) trouvée(s) sur ${demandees} demandée(s) pour « ${e.id} »`;
  if (presentes.length !== (e.medias?.length ?? 0)) return `une clé de vidéo est vide pour « ${e.id} »`;
  return null;
}

/** Rangs (dans `elementsV4`) des plaquettes qui exigent des vidéos qu'elles n'ont pas. PUR. */
export function plaquettesSansVideo(plan: PlanAvecElementsV4): number[] {
  return (plan.elementsV4 ?? []).flatMap((e, i) => (raisonSansVideoV4(e) ? [i] : []));
}

export interface PlaquetteRetireeV4 {
  /** Rang dans le plan REÇU. */
  rang: number;
  id: string;
  debut: number;
  fin: number;
  raison: string;
}

/** Nouveau plan sans les plaquettes privées de vidéo, et la liste de ce qui a été retiré. Le plan reçu n'est pas modifié. PUR. */
export function retirerPlaquettesSansVideo<P extends PlanAvecElementsV4>(plan: P): { plan: P; retirees: PlaquetteRetireeV4[] } {
  const retirees: PlaquetteRetireeV4[] = [];
  const gardees = (plan.elementsV4 ?? []).filter((e, rang) => {
    const raison = raisonSansVideoV4(e);
    if (raison) retirees.push({ rang, id: e.id, debut: e.debut, fin: e.fin, raison });
    return !raison;
  });
  if (!retirees.length) return { plan, retirees };
  return { plan: { ...plan, elementsV4: gardees }, retirees };
}

