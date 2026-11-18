/**
 * S-01 · Pannes « non relié » RENDUES par un moteur (et non levées) : le serveur de rendu ou le stockage est absent, l'échec
 * tombe AVANT tout appel payant. Le travail attend et repart seul, 24 h au plus depuis la 1re panne, au lieu de finir en échec.
 * Liste FERMÉE : aucun autre code (refus de contenu, `*_REFUS`, attente de validation, crédit) n'y entre.
 * Module pur : dépend seulement de `suivi` (pur) et des types.
 */
import { apresPanne, ATTENTE_MAX_MS } from "@/domaine/suivi";
import type { RepriseTravail, Travail } from "@/domaine/types";

export const CODES_PANNE_RENDUE = ["TABLEAU_NON_RELIE", "CAS_CONCRET_NON_RELIE", "FACECAM_NON_RELIE", "FACECAM_ANIMEE_NON_RELIE", "IV_NON_RELIE"] as const;

/** Préfixe de `reprise.derniereErreur` posé par S-01 : seule une reprise ainsi marquée survit à un tour sans vrai progrès. */
export const MARQUE_REPRISE_RENDUE = "[panne rendue] ";

/** Vrai si l'erreur est l'un des 5 codes ET marquée `reessayable: true` (la voix non épinglée du cas concret reste un échec). */
export function estPanneRendue(erreur: { code?: string; reessayable?: boolean } | null | undefined): boolean {
  return !!erreur && erreur.reessayable === true && (CODES_PANNE_RENDUE as readonly string[]).includes(erreur.code ?? "");
}

/** `estPanneRendue`, SAUF le cas concret sur l'étape payée « ecriture » (061a5ba1 : relancerait un appel Claude sans l'accord de « Reprendre »). */
export function panneRendueQuiRepart(travail: Pick<Travail, "erreur" | "etapes">): boolean {
  return estPanneRendue(travail.erreur) && !(travail.erreur?.code === "CAS_CONCRET_NON_RELIE" && travail.etapes.some((e) => e.cle === "ecriture" && e.statut === "echec"));
}

export const estRepriseRendue = (r: RepriseTravail | undefined): boolean => !!r && r.motif !== "credit" && !!r.derniereErreur?.startsWith(MARQUE_REPRISE_RENDUE);

/** Entrée en attente (→ 1 notification) : ni reprise S-01 en cours, ni attente déjà annoncée par `ecrirePanne`. */
export const entreEnAttenteRendue = (r: RepriseTravail | undefined): boolean => !estRepriseRendue(r) && !r?.attenteDepuis;

/** `apresPanne` + marque + borne ABSOLUE de 24 h depuis la 1re panne (`premiereLe`). Une reprise « crédit » n'est pas reprise. PUR. */
export function suiteDePanneRendue(reprise: RepriseTravail | undefined, maintenant: number, message: string): { reprise: RepriseTravail; abandon: boolean } {
  const base = reprise?.motif === "credit" ? undefined : reprise;
  const suite = apresPanne(base, maintenant, MARQUE_REPRISE_RENDUE + message);
  const depuis = maintenant - new Date(suite.reprise.premiereLe).getTime();
  return { reprise: suite.reprise, abandon: suite.abandon || depuis >= ATTENTE_MAX_MS };
}

const faites = (t: Pick<Travail, "etapes">): number => t.etapes.filter((e) => e.statut === "terminee").length;

/**
 * Tour écrit SANS vrai progrès (aucune étape de plus terminée) après une panne rendue : la reprise marquée est gardée,
 * sans `attenteDepuis` (l'outil répond : la vidéo ne dit plus « attend un outil »). La borne de 24 h et l'unique
 * notification tiennent donc même si l'outil tombe et revient. Sinon (vrai progrès, autre statut, reprise de master) :
 * le travail est rendu TEL QUEL (même objet). PUR.
 */
export function garderRepriseRendue(actuel: Pick<Travail, "etapes" | "reprise">, travail: Travail): Travail {
  const r = actuel.reprise;
  if (travail.statut !== "en_cours" || !r || !estRepriseRendue(r) || faites(travail) > faites(actuel)) return travail;
  const { attenteDepuis: _attente, ...gardee } = r;
  void _attente;
  return { ...travail, reprise: gardee };
}
