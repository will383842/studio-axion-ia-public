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

export const MESSAGE_LISTE_CHANGEE = "La liste a changé : rechargez la page.";
export const MESSAGE_RELECTURE_INCERTAINE = "Le diffuseur n'a pas répondu clairement : rien n'a été retiré. Réessayez dans quelques minutes.";

/** Ce que répond le diffuseur à la relecture seule d'une publication : elle y est (« present »), n'y est plus (« introuvable »), ou la réponse n'est pas claire (« incertain »). */
export type VerdictRelecture = "present" | "introuvable" | "incertain";
export type ResultatRetraitRelu = { ok: true; retirees: number; remises: number; message: string } | { ok: false; message: string };

/** Empreinte des champs qui décident du retrait : si elle change entre la sélection et l'écriture, on ne retire pas. */
const empreinte = (p: Publication): string => JSON.stringify([p.etatEnvoi, p.retireeLe, p.statut, p.constatsIntrouvable, p.introuvableDepuis, p.dernierConstatIntrouvable, p.etatLuLe, p.modifieLe]);

export interface SelectionRetrait {
  /** Les publications à relire (10 au plus), triées par identifiant. */
  verifiees: Publication[];
  /** Nombre de retirables non relues à ce clic. */
  restantes: number;
  /** Empreintes de TOUTES les retirables au moment de la sélection. */
  empreintes: Map<string, string>;
}

/** Phase 1 (sous verrou, sans réseau) : l'ensemble retirable doit être exactement celui affiché. */
export function selectionnerRetrait(publications: readonly Publication[], ids: readonly string[], maintenantIso: string, espaceRetrouveLe?: string): SelectionRetrait | null {
  const demandes = new Set(ids);
  if (demandes.size === 0 || demandes.size !== ids.length) return null;
  const retirables = publications.filter((p) => estRapatrieeRetirable(p, Date.parse(maintenantIso), espaceRetrouveLe)).sort((a, b) => a.id.localeCompare(b.id));
  if (retirables.length !== demandes.size || !retirables.every((p) => demandes.has(p.id))) return null;
  const verifiees = retirables.slice(0, RETRAITS_MAX_PAR_CLIC);
  return { verifiees, restantes: retirables.length - verifiees.length, empreintes: new Map(retirables.map((p) => [p.id, empreinte(p)])) };
}

/**
 * Phase 3 (sous verrou, écriture locale seule) : l'état relu doit être identique à celui de la sélection (mêmes retirables, mêmes empreintes) ;
 * sinon rien n'est écrit. Celle dont le diffuseur répond est remise à la normale ; celle dont la réponse n'est pas claire reste en place ;
 * seules les vérifiées « introuvables » reçoivent `retireeLe`. N'écrit rien chez le diffuseur.
 */
export async function appliquerRetraitRelu(
  d: { lister(): Promise<Publication[]>; ecrire(id: string, modif: Partial<Publication>): Promise<void>; maintenant(): string },
  ids: readonly string[],
  avant: SelectionRetrait,
  verdicts: ReadonlyMap<string, VerdictRelecture>,
  espaceRetrouveLe?: string,
): Promise<ResultatRetraitRelu> {
  const m = d.maintenant();
  const publications = await d.lister();
  const maintenant = selectionnerRetrait(publications, ids, m, espaceRetrouveLe);
  const inchange = !!maintenant && maintenant.empreintes.size === avant.empreintes.size && [...avant.empreintes].every(([id, e]) => maintenant.empreintes.get(id) === e);
  if (!inchange) return { ok: false, message: MESSAGE_LISTE_CHANGEE };
  let retirees = 0;
  let remises = 0;
  let incertaines = 0;
  for (const p of avant.verifiees) {
    const verdict = verdicts.get(p.id) ?? "incertain";
    if (verdict === "introuvable") {
      await d.ecrire(p.id, { retireeLe: m, modifieLe: m });
      retirees++;
    } else if (verdict === "present") {
      await d.ecrire(p.id, { ...remiseANormale(), modifieLe: m });
      remises++;
    } else incertaines++;
  }
  const restantes = avant.restantes;
  if (retirees === 0 && remises === 0) return { ok: false, message: MESSAGE_RELECTURE_INCERTAINE };
  const phrases = retirees > 0 ? [`${retirees} publication${retirees > 1 ? "s" : ""} retirée${retirees > 1 ? "s" : ""} du calendrier.`] : [];
  if (remises > 0) phrases.push(`${remises} ${remises > 1 ? "sont" : "est"} encore chez le diffuseur : ${remises > 1 ? "elles ne sont pas retirées et sont remises" : "elle n'est pas retirée et est remise"} à la normale.`);
  if (incertaines > 0) phrases.push(`${incertaines} n'${incertaines > 1 ? "ont" : "a"} pas pu être vérifiée${incertaines > 1 ? "s" : ""} : ${incertaines > 1 ? "elles restent" : "elle reste"} en place.`);
  if (restantes > 0) phrases.push(`Seules ${avant.verifiees.length} publications sont vérifiées à chaque fois : ${restantes} autre${restantes > 1 ? "s restent" : " reste"} à retirer, recommencez après avoir rechargé la page.`);
  return { ok: true, retirees, remises, message: `${retirees > 0 ? "C'est fait : " : "Rien n'est retiré du calendrier. "}${phrases.join(" ")} Rien n'est supprimé ni changé chez le diffuseur.` };
}
