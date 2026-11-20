import "server-only";
/**
 * RAP-3 · « Retirer du calendrier » une publication rapatriée : geste LOCAL. Il pose `retireeLe` et rien d'autre : la ligne, son texte et
 * son statut restent, et RIEN n'est demandé au diffuseur (le post reste programmé chez lui). Aucune dépendance au client du diffuseur.
 */
import { estRapatriee, type Publication } from "@/domaine/types";
import { CONSTATS_INTROUVABLE_REQUIS, DELAI_RETRAIT_INTROUVABLE_MS } from "@/services/constantes-introuvable";

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
 * Retirable EN GROUPE : introuvable depuis au moins 24 h ET après au moins deux réponses « introuvable » à des passages distincts.
 * Sans les champs de constat (publication d'avant), jamais retirable tant que les deux constats ne sont pas faits.
 */
export const estRapatrieeRetirable = (p: Publication, instantMs: number): boolean => {
  if (!estRapatrieeIntrouvable(p)) return false;
  const depuis = p.introuvableDepuis ? Date.parse(p.introuvableDepuis) : NaN;
  return (p.constatsIntrouvable ?? 0) >= CONSTATS_INTROUVABLE_REQUIS && Number.isFinite(depuis) && instantMs - depuis >= DELAI_RETRAIT_INTROUVABLE_MS;
};

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
