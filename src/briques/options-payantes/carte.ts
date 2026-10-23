/**
 * TEXTES DE LA CARTE DE CONFIRMATION (lot J). PUR.
 *
 * Le SEUL endroit du format face caméra où un montant apparaît : « Option payante — environ X € pris sur vos crédits
 * <outil>. [Confirmer] [Annuler] ». Vocabulaire simple, montant arrondi à l'euro supérieur (jamais sous-estimé).
 */
import { NOMS_OUTILS, OPTIONS_PAYANTES } from "./registre";
import type { DemandeConfirmation, EtatDemande, IdOptionPayante, OutilPayant } from "./types";

/** « environ 4 € » ; sous 1 € : « moins de 1 € ». */
export function montantEnvironEuros(centimes: number): string {
  if (centimes < 100) return "moins de 1 €";
  return `environ ${Math.ceil(centimes / 100 - 1e-9)} €`;
}

export const TEXTES_CARTE = {
  titre: "Option payante",
  confirmer: "Confirmer",
  annuler: "Annuler",
  confirmee: "Confirmé : le studio s'en occupe.",
  annulee: "Annulé : la version gratuite est gardée.",
  expiree: "Demande expirée : rien n'a été dépensé.",
  utilisee: "Fait.",
} as const;

export function phraseCarte(c: { montantCentimes: number; outil: OutilPayant; precision?: string; optionId?: IdOptionPayante }): string {
  const fin = `${montantEnvironEuros(c.montantCentimes)}${c.precision ? ` ${c.precision}` : ""} pris sur vos crédits ${NOMS_OUTILS[c.outil]}.`;
  // Lot K : « Effet réaliste par IA — option payante, environ 3 € pris sur vos crédits Higgsfield. »
  const option = c.optionId ? OPTIONS_PAYANTES[c.optionId] : undefined;
  if (option?.nommeeDansLaCarte) return `${option.libelle} — ${TEXTES_CARTE.titre.toLowerCase()}, ${fin}`;
  return `${TEXTES_CARTE.titre} — ${fin}`;
}

/**
 * Lot K : aperçu montré AVEC la carte, avant toute dépense (effet réaliste) : l'image fixe du moment choisi, la phrase
 * dite à cet instant, et « Changer de moment ».
 */
export interface ApercuCarte {
  /** « 0:42 » (temps de la vidéo livrée). */
  instant: string;
  instantSec: number;
  /** Phrase dite à cet instant (« … et là je sors mon téléphone … »). */
  phrase: string;
  /** Adresse (signée, courte) de l'image fixe du moment ; absente : la carte montre l'instant et la phrase seuls. */
  imageUrl?: string;
  /** Ce que l'effet fera, en français simple (« Un téléphone apparaît dans votre main, puis vous le jetez vers l'écran »). */
  description?: string;
}

/** Ce que l'écran reçoit (sérialisable). Le jeton n'autorise rien sans session : il désigne la demande. */
export interface VueCarteConfirmation {
  jeton: string;
  optionId: IdOptionPayante;
  libelle: string;
  phrase: string;
  etat: EtatDemande;
  expireLe: string;
  /** Lot K (facultatif) : aperçu du moment choisi (effet réaliste). */
  apercu?: ApercuCarte;
}

export function vueCarte(d: DemandeConfirmation, etat: EtatDemande = d.etat, apercu?: ApercuCarte): VueCarteConfirmation {
  return { jeton: d.jeton, optionId: d.optionId, libelle: d.libelle, phrase: phraseCarte(d), etat, expireLe: d.expireLe, ...(apercu ? { apercu } : {}) };
}

export function texteEtat(etat: EtatDemande): string | null {
  return etat === "en-attente" ? null : TEXTES_CARTE[etat];
}
