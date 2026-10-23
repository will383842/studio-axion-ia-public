/**
 * CONFIRMATION D'UNE OPTION PAYANTE (lot J). PUR : l'horloge et le jeton sont donnés par l'appelant.
 *
 *  - `demanderConfirmation` : crée la demande « en attente » (carte à montrer), SAUF si le plafond du mois ne permet
 *    pas la dépense : le plafond passe avant tout, aucune carte n'est montrée et la version gratuite sort ;
 *  - `confirmer` / `annuler` : la réponse de Will, une seule fois ;
 *  - `consommer` : au moment de l'appel au fournisseur (serveur), la confirmation doit être valide, pour CETTE option,
 *    CETTE vidéo, avec CE jeton ; elle est alors utilisée et liée à la version qui dépense. Une seconde utilisation est
 *    refusée : une confirmation ne vaut que pour la demande qui l'a portée.
 *  - expiration : 24 h après la demande, une demande non utilisée ne vaut plus rien.
 */
import { estimerOption, MESSAGE_OPTION_RETIREE, OPTIONS_PAYANTES, optionRetiree, TARIFS_PAR_DEFAUT } from "./registre";
import type { ContexteOption, DemandeConfirmation, IdOptionPayante, OrigineDemande, Tarifs } from "./types";

export const VALIDITE_CONFIRMATION_MS = 24 * 60 * 60 * 1000;

export const MESSAGE_PLAFOND = "Plafond du mois atteint : l'option payante n'est pas faite, la version gratuite sort.";

export type ResultatDemande = { statut: "a-confirmer"; demande: DemandeConfirmation } | { statut: "plafond" | "coupee"; message: string };

export function demanderConfirmation(
  optionId: IdOptionPayante,
  contexte: ContexteOption,
  o: { maintenant: Date; jeton: string; origine: OrigineDemande; restantDuMoisCentimes: number; tarifs?: Tarifs; message?: string },
): ResultatDemande {
  // Vérif V4 : une option retirée (Décor IA) n'est jamais proposée.
  if (optionRetiree(optionId)) return { statut: "coupee", message: MESSAGE_OPTION_RETIREE };
  const option = OPTIONS_PAYANTES[optionId];
  const montantCentimes = estimerOption(optionId, contexte, o.tarifs ?? TARIFS_PAR_DEFAUT);
  if (montantCentimes > Math.max(0, o.restantDuMoisCentimes)) return { statut: "plafond", message: MESSAGE_PLAFOND };
  if (o.jeton.length < 16) throw new Error("Jeton de confirmation trop court.");
  return {
    statut: "a-confirmer",
    demande: {
      jeton: o.jeton,
      optionId,
      outil: option.outil,
      libelle: option.libelle,
      videoId: contexte.videoId,
      versionOrigineId: contexte.versionId,
      montantCentimes,
      etat: "en-attente",
      origine: o.origine,
      ...(o.message ? { message: o.message.slice(0, 300) } : {}),
      creeLe: o.maintenant.toISOString(),
      expireLe: new Date(o.maintenant.getTime() + VALIDITE_CONFIRMATION_MS).toISOString(),
    },
  };
}

export const estExpiree = (d: DemandeConfirmation, maintenant: Date) => maintenant.getTime() >= Date.parse(d.expireLe);

/** L'état réel d'une demande à cet instant (une demande ouverte trop vieille est expirée). */
export function etatActuel(d: DemandeConfirmation, maintenant: Date): DemandeConfirmation["etat"] {
  if ((d.etat === "en-attente" || d.etat === "confirmee") && estExpiree(d, maintenant)) return "expiree";
  return d.etat;
}

export type RaisonRefus = "jeton" | "expiree" | "deja-traitee" | "non-confirmee" | "deja-utilisee" | "autre-option" | "autre-video" | "autre-version" | "annulee" | "retiree";

export type Reponse = { ok: true; demande: DemandeConfirmation } | { ok: false; raison: RaisonRefus };

function memeJeton(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function repondre(d: DemandeConfirmation, jeton: string, maintenant: Date, etat: "confirmee" | "annulee"): Reponse {
  if (!memeJeton(d.jeton, jeton)) return { ok: false, raison: "jeton" };
  const actuel = etatActuel(d, maintenant);
  if (actuel === "expiree") return { ok: false, raison: "expiree" };
  if (actuel !== "en-attente") return { ok: false, raison: "deja-traitee" };
  // Vérif V4 : une option retirée ne se confirme plus (carte déjà affichée sur une ancienne vidéo).
  if (etat === "confirmee" && optionRetiree(d.optionId)) return { ok: false, raison: "retiree" };
  return { ok: true, demande: { ...d, etat, traiteeLe: maintenant.toISOString() } };
}

export const confirmer = (d: DemandeConfirmation, jeton: string, maintenant: Date) => repondre(d, jeton, maintenant, "confirmee");
export const annuler = (d: DemandeConfirmation, jeton: string, maintenant: Date) => repondre(d, jeton, maintenant, "annulee");

/** Ce que l'appel payant présente : l'option, la vidéo et la version qui dépensent, et le jeton porté par la version. */
export interface Presentation {
  optionId: IdOptionPayante;
  videoId: string;
  versionId: string;
  jeton: string;
}

/** Contrôle SANS consommer (la décision « demander ou dépenser » avant de lancer une passe). */
export function verifier(d: DemandeConfirmation | undefined, p: Presentation, maintenant: Date): { ok: true } | { ok: false; raison: RaisonRefus } {
  if (!d || !memeJeton(d.jeton, p.jeton)) return { ok: false, raison: "jeton" };
  if (d.optionId !== p.optionId) return { ok: false, raison: "autre-option" };
  if (optionRetiree(d.optionId)) return { ok: false, raison: "retiree" };
  if (d.videoId !== p.videoId) return { ok: false, raison: "autre-video" };
  if (d.versionCibleId && d.versionCibleId !== p.versionId) return { ok: false, raison: "autre-version" };
  const actuel = etatActuel(d, maintenant);
  if (actuel === "expiree") return { ok: false, raison: "expiree" };
  if (actuel === "utilisee") return { ok: false, raison: "deja-utilisee" };
  if (actuel === "annulee") return { ok: false, raison: "annulee" };
  if (actuel !== "confirmee") return { ok: false, raison: "non-confirmee" };
  return { ok: true };
}

/** Utilise la confirmation (une seule fois) et la lie à la version qui dépense. */
export function consommer(d: DemandeConfirmation | undefined, p: Presentation, maintenant: Date): Reponse {
  const v = verifier(d, p, maintenant);
  if (!v.ok) return v;
  return { ok: true, demande: { ...d!, etat: "utilisee", versionId: p.versionId, traiteeLe: maintenant.toISOString() } };
}

/** Rangement : marque les expirées, garde les plus récentes (la liste vit dans un paramètre). */
export function ranger(demandes: DemandeConfirmation[], maintenant: Date, max = 200): DemandeConfirmation[] {
  const vieille = maintenant.getTime() - 7 * VALIDITE_CONFIRMATION_MS;
  return demandes
    .map((d) => (etatActuel(d, maintenant) === d.etat ? d : { ...d, etat: "expiree" as const }))
    .filter((d) => Date.parse(d.creeLe) >= vieille)
    .slice(-max);
}
