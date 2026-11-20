import "server-only";
/**
 * RAP-3 · « Retirer du calendrier » une publication rapatriée : geste LOCAL. Il pose `retireeLe` et rien d'autre : la ligne, son texte et
 * son statut restent, et RIEN n'est demandé au diffuseur (le post reste programmé chez lui). Aucune dépendance au client du diffuseur.
 */
import { estRapatriee, type Publication } from "@/domaine/types";
import { CONSTATS_INTROUVABLE_REQUIS, DELAI_RETRAIT_INTROUVABLE_MS, FRAICHEUR_CONSTAT_INTROUVABLE_MS, MESSAGE_AUCUN_POST_RETROUVE, mesureAttesteEspaceConnu, type MesureEcartMinimale } from "@/services/constantes-introuvable";

export type ResultatRetraitRapatriee = { ok: true; message: string } | { ok: false; etat: "introuvable" | "pas-rapatriee" | "deja-fait" | "publiee"; message: string };

export interface DepsRetraitRapatriee {
  publication(id: string): Promise<Publication | null>;
  ecrire(id: string, modif: Partial<Publication>): Promise<void>;
  maintenant(): string;
}

export const MESSAGE_RETRAIT_LOCAL = "C'est fait : ce post n'est plus au calendrier du Studio. Il reste programmé chez le diffuseur.";

export async function retirerRapatrieeDuCalendrier(d: DepsRetraitRapatriee, id: string): Promise<ResultatRetraitRapatriee> {
  const p = await d.publication(id);
  if (!p) return { ok: false, etat: "introuvable", message: "Cette publication est introuvable. Rechargez la page." };
  if (!estRapatriee(p)) return { ok: false, etat: "pas-rapatriee", message: "Seule une publication reprise du diffuseur se retire d'ici." };
  if (p.retireeLe) return { ok: false, etat: "deja-fait", message: "Ce post est déjà retiré du calendrier." };
  if (p.statut === "publiee") return { ok: false, etat: "publiee", message: "Ce post est déjà publié : il reste dans l'historique." };
  const maintenant = d.maintenant();
  await d.ecrire(id, { retireeLe: maintenant, modifieLe: maintenant });
  return { ok: true, message: MESSAGE_RETRAIT_LOCAL };
}

/** RAP-3 finitions · rapatriée INTROUVABLE chez le diffuseur : « à vérifier », encore au calendrier, ni retirée ni publiée. */
export const estRapatrieeIntrouvable = (p: Publication): boolean => estRapatriee(p) && !p.retireeLe && p.etatEnvoi === "a-verifier" && p.statut !== "publiee";

/**
 * Retirable EN GROUPE : au moins deux réponses « introuvable » à des passages distincts, le DERNIER constat datant de moins d'une heure
 * ET séparé du premier d'au moins 24 h. Sans ces champs (publication d'avant), jamais retirable.
 */
export const estRapatrieeRetirable = (p: Publication, instantMs: number): boolean => {
  if (!estRapatrieeIntrouvable(p)) return false;
  const premier = p.introuvableDepuis ? Date.parse(p.introuvableDepuis) : NaN;
  const dernier = p.dernierConstatIntrouvable ? Date.parse(p.dernierConstatIntrouvable) : NaN;
  return (
    (p.constatsIntrouvable ?? 0) >= CONSTATS_INTROUVABLE_REQUIS &&
    Number.isFinite(premier) &&
    Number.isFinite(dernier) &&
    dernier - premier >= DELAI_RETRAIT_INTROUVABLE_MS &&
    instantMs - dernier <= FRAICHEUR_CONSTAT_INTROUVABLE_MS
  );
};

/** Rapatriée encore attendue chez le diffuseur (saine ou « à vérifier »), ni retirée ni publiée. */
export const estRapatrieeSuivie = (p: Publication): boolean => estRapatriee(p) && !p.retireeLe && p.statut !== "publiee" && (p.statut === "brouillon" || p.statut === "programmee");

/**
 * Le retrait groupé est-il SÛR ? Refus (message clair) si la mesure laisse penser que la clé relie un autre espace (aucune publication suivie
 * retrouvée dans la liste vérifiée), ou si TOUTES les rapatriées suivies sont introuvables en même temps (retrait de masse).
 */
export function retraitGroupeSur(mesure: MesureEcartMinimale | null | undefined, publications: readonly Publication[]): { sur: true } | { sur: false; message: string } {
  if (!mesureAttesteEspaceConnu(mesure)) return { sur: false, message: MESSAGE_AUCUN_POST_RETROUVE };
  const suivies = publications.filter(estRapatrieeSuivie);
  if (suivies.length > 0 && suivies.every(estRapatrieeIntrouvable)) return { sur: false, message: MESSAGE_AUCUN_POST_RETROUVE };
  return { sur: true };
}

export interface DepsRetraitIntrouvables {
  lister(): Promise<Publication[]>;
  ecrire(id: string, modif: Partial<Publication>): Promise<void>;
  maintenant(): string;
}

export type ResultatRetraitGroupe = { ok: true; retirees: number } | { ok: false; message: string };
export const MESSAGE_LISTE_CHANGEE = "La liste a changé : rechargez la page.";

/**
 * Geste LOCAL groupé : pose `retireeLe` sur les seules rapatriées dont l'identifiant a été AFFICHÉ, après revérification de chacune
 * au moment du clic. Si l'ensemble retirable a changé (en plus ou en moins), rien n'est écrit. N'efface rien, ne demande rien au diffuseur.
 */
export async function retirerLesRapatrieesIntrouvables(d: DepsRetraitIntrouvables, ids: readonly string[]): Promise<ResultatRetraitGroupe> {
  const m = d.maintenant();
  const demandes = new Set(ids);
  if (demandes.size === 0 || demandes.size !== ids.length) return { ok: false, message: MESSAGE_LISTE_CHANGEE };
  const retirables = (await d.lister()).filter((p) => estRapatrieeRetirable(p, Date.parse(m)));
  if (retirables.length !== demandes.size || !retirables.every((p) => demandes.has(p.id))) return { ok: false, message: MESSAGE_LISTE_CHANGEE };
  for (const p of retirables) await d.ecrire(p.id, { retireeLe: m, modifieLe: m });
  return { ok: true, retirees: retirables.length };
}
