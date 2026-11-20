import "server-only";
/**
 * RAP-3 · « Retirer du calendrier » une publication rapatriée : geste LOCAL. Il pose `retireeLe` et rien d'autre : la ligne, son texte et
 * son statut restent, et RIEN n'est demandé au diffuseur (le post reste programmé chez lui). Aucune dépendance au client du diffuseur.
 */
import { estRapatriee, type Publication } from "@/domaine/types";
import { CONSTATS_INTROUVABLE_REQUIS, DELAI_RETRAIT_INTROUVABLE_MS, FRAICHEUR_CONSTAT_INTROUVABLE_MS, MESSAGE_AUCUN_POST_RETROUVE, RETRAITS_MAX_PAR_CLIC, mesureAttesteEspaceConnu, type MesureEcartMinimale } from "@/services/constantes-introuvable";

export type ResultatRetraitRapatriee = { ok: true; message: string } | { ok: false; etat: "introuvable" | "pas-rapatriee" | "deja-fait" | "publiee"; message: string };

export interface DepsRetraitRapatriee {
  publication(id: string): Promise<Publication | null>;
  ecrire(id: string, modif: Partial<Publication>): Promise<void>;
  maintenant(): string;
}

export const MESSAGE_RETRAIT_LOCAL = "C'est fait : ce post n'est plus au calendrier du Studio. Il reste programmé chez le diffuseur.";
/** Rapatriée « à vérifier » : le diffuseur ne la retrouve plus, le retrait local ne change rien chez lui. */
export const MESSAGE_RETRAIT_LOCAL_INTROUVABLE = "C'est fait : ce post n'est plus au calendrier du Studio. Le diffuseur ne retrouve plus ce post ; rien n'est changé chez lui.";

/** Remise à la normale d'une rapatriée « à vérifier » que le diffuseur a de nouveau retrouvée : plus introuvable, plus retirable (le statut est relu à la synchro). */
export const remiseANormale = (): Partial<Publication> => ({ etatEnvoi: undefined, erreur: undefined, introuvableDepuis: undefined, constatsIntrouvable: undefined, dernierConstatIntrouvable: undefined });

export async function retirerRapatrieeDuCalendrier(d: DepsRetraitRapatriee, id: string): Promise<ResultatRetraitRapatriee> {
  const p = await d.publication(id);
  if (!p) return { ok: false, etat: "introuvable", message: "Cette publication est introuvable. Rechargez la page." };
  if (!estRapatriee(p)) return { ok: false, etat: "pas-rapatriee", message: "Seule une publication reprise du diffuseur se retire d'ici." };
  if (p.retireeLe) return { ok: false, etat: "deja-fait", message: "Ce post est déjà retiré du calendrier." };
  if (p.statut === "publiee") return { ok: false, etat: "publiee", message: "Ce post est déjà publié : il reste dans l'historique." };
  const maintenant = d.maintenant();
  await d.ecrire(id, { retireeLe: maintenant, modifieLe: maintenant });
  return { ok: true, message: estRapatrieeIntrouvable(p) ? MESSAGE_RETRAIT_LOCAL_INTROUVABLE : MESSAGE_RETRAIT_LOCAL };
}

/** RAP-3 finitions · rapatriée INTROUVABLE chez le diffuseur : « à vérifier », encore au calendrier, ni retirée ni publiée. */
export const estRapatrieeIntrouvable = (p: Publication): boolean => estRapatriee(p) && !p.retireeLe && p.etatEnvoi === "a-verifier" && p.statut !== "publiee";

/**
 * Retirable EN GROUPE : au moins deux réponses « introuvable » à des passages distincts, le DERNIER constat datant de moins d'une heure
 * ET séparé du premier d'au moins 24 h. Sans ces champs (publication d'avant), jamais retirable.
 */
export const estRapatrieeRetirable = (p: Publication, instantMs: number, espaceRetrouveLe?: string): boolean => {
  if (!estRapatrieeIntrouvable(p)) return false;
  const premier = p.introuvableDepuis ? Date.parse(p.introuvableDepuis) : NaN;
  const dernier = p.dernierConstatIntrouvable ? Date.parse(p.dernierConstatIntrouvable) : NaN;
  return (
    (p.constatsIntrouvable ?? 0) >= CONSTATS_INTROUVABLE_REQUIS &&
    Number.isFinite(premier) &&
    Number.isFinite(dernier) &&
    dernier - premier >= DELAI_RETRAIT_INTROUVABLE_MS &&
    instantMs - dernier <= FRAICHEUR_CONSTAT_INTROUVABLE_MS &&
    // Après la chute de la marque d'espace suspect : seuls les constats postérieurs comptent (un passage complet s'est terminé depuis).
    (!espaceRetrouveLe || !(dernier <= Date.parse(espaceRetrouveLe)))
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
export async function retirerLesRapatrieesIntrouvables(d: DepsRetraitIntrouvables, ids: readonly string[], espaceRetrouveLe?: string): Promise<ResultatRetraitGroupe> {
  const m = d.maintenant();
  const demandes = new Set(ids);
  if (demandes.size === 0 || demandes.size !== ids.length) return { ok: false, message: MESSAGE_LISTE_CHANGEE };
  const retirables = (await d.lister()).filter((p) => estRapatrieeRetirable(p, Date.parse(m), espaceRetrouveLe));
  if (retirables.length !== demandes.size || !retirables.every((p) => demandes.has(p.id))) return { ok: false, message: MESSAGE_LISTE_CHANGEE };
  for (const p of retirables) await d.ecrire(p.id, { retireeLe: m, modifieLe: m });
  return { ok: true, retirees: retirables.length };
}

/** Ce que répond le diffuseur à la relecture seule d'une publication : elle y est (« present »), n'y est plus (« introuvable »), ou la réponse n'est pas claire (« incertain »). */
export type VerdictRelecture = "present" | "introuvable" | "incertain";
export interface DepsRetraitRelu extends DepsRetraitIntrouvables {
  /** Lecture SEULE chez le diffuseur ; ne lève jamais. */
  relire(p: Publication): Promise<VerdictRelecture>;
}
export type ResultatRetraitRelu = { ok: true; retirees: number; remises: number; message: string } | { ok: false; message: string };

/**
 * Retrait groupé au clic : même contrôle de la liste, puis chaque publication à retirer (10 au plus) est relue seule chez le diffuseur.
 * Celle qui répond est refusée et remise à la normale ; celle dont la réponse n'est pas claire n'est pas retirée ; seules les vérifiées
 * « introuvables » reçoivent `retireeLe`. Au-delà de 10, les autres restent telles quelles (et le message le dit). N'écrit rien chez le diffuseur.
 */
export async function retirerLesRapatrieesApresRelecture(d: DepsRetraitRelu, ids: readonly string[], espaceRetrouveLe?: string): Promise<ResultatRetraitRelu> {
  const m = d.maintenant();
  const demandes = new Set(ids);
  if (demandes.size === 0 || demandes.size !== ids.length) return { ok: false, message: MESSAGE_LISTE_CHANGEE };
  const retirables = (await d.lister()).filter((p) => estRapatrieeRetirable(p, Date.parse(m), espaceRetrouveLe)).sort((a, b) => a.id.localeCompare(b.id));
  if (retirables.length !== demandes.size || !retirables.every((p) => demandes.has(p.id))) return { ok: false, message: MESSAGE_LISTE_CHANGEE };
  const verifiees = retirables.slice(0, RETRAITS_MAX_PAR_CLIC);
  const restantes = retirables.length - verifiees.length;
  let retirees = 0;
  let remises = 0;
  let incertaines = 0;
  for (const p of verifiees) {
    const verdict = await d.relire(p);
    if (verdict === "introuvable") {
      await d.ecrire(p.id, { retireeLe: m, modifieLe: m });
      retirees++;
    } else if (verdict === "present") {
      await d.ecrire(p.id, { ...remiseANormale(), modifieLe: m });
      remises++;
    } else incertaines++;
  }
  if (retirees === 0 && remises === 0) return { ok: false, message: "Le diffuseur n'a pas répondu clairement : rien n'a été retiré. Réessayez dans quelques minutes." };
  const phrases = [`${retirees} publication${retirees > 1 ? "s" : ""} retirée${retirees > 1 ? "s" : ""} du calendrier.`];
  if (remises > 0) phrases.push(`${remises} ${remises > 1 ? "sont" : "est"} encore chez le diffuseur : ${remises > 1 ? "elles ne sont pas retirées et sont remises" : "elle n'est pas retirée et est remise"} à la normale.`);
  if (incertaines > 0) phrases.push(`${incertaines} n'${incertaines > 1 ? "ont" : "a"} pas pu être vérifiée${incertaines > 1 ? "s" : ""} : ${incertaines > 1 ? "elles restent" : "elle reste"} en place.`);
  if (restantes > 0) phrases.push(`Seules ${verifiees.length} publications sont vérifiées à chaque fois : ${restantes} autre${restantes > 1 ? "s restent" : " reste"} à retirer, recommencez après avoir rechargé la page.`);
  return { ok: true, retirees, remises, message: `C'est fait : ${phrases.join(" ")} Rien n'est supprimé ni changé chez le diffuseur.` };
}
