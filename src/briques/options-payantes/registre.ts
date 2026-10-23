/**
 * REGISTRE DES OPTIONS PAYANTES (lot J). PUR.
 *
 * Chaque option porte son outil, un libellé simple et son devis en euros, tiré du devis du fournisseur :
 *  - Higgsfield (Décor IA, effets main « ultra réaliste ») : crédits du devis Higgsfield × prix du crédit (réglable) ;
 *  - HeyGen (multicaméra réelle) : devis existant du double, à la seconde rendue (`CENTIMES_USD_PAR_SECONDE_AVATAR_V`),
 *    une fois par angle fabriqué, au taux dollar → euro du studio.
 */
import { creditsPourVideo, PRIX_CREDIT_HIGGSFIELD_CENTIMES } from "@/briques/decor/cout";
import { CENTIMES_USD_PAR_SECONDE_AVATAR_V } from "@/fournisseurs/heygen/rendus";
import { TAUX_USD_EUR_PAR_DEFAUT } from "@/lib/montants";
import type { ContexteOption, IdOptionPayante, OutilPayant, Tarifs } from "./types";

export interface OptionPayante {
  id: IdOptionPayante;
  outil: OutilPayant;
  /** Nom de l'option, en mots simples (« Décor IA »). */
  libelle: string;
  /**
   * Lot K (facultatif) : la carte commence par le nom de l'option (« Effet réaliste par IA — option payante, environ
   * 3 € pris sur vos crédits Higgsfield. »). Absent : « Option payante — … » (lot J, inchangé).
   */
  nommeeDansLaCarte?: boolean;
  /** Estimation du coût, en centimes d'euro (arrondie au centime supérieur : jamais sous-estimée). */
  estimer(contexte: ContexteOption, tarifs: Tarifs): number;
}

export const TARIFS_PAR_DEFAUT: Tarifs = { prixCreditHiggsfieldCentimes: PRIX_CREDIT_HIGGSFIELD_CENTIMES, tauxUsdEur: TAUX_USD_EUR_PAR_DEFAUT };

export const NOMS_OUTILS: Record<OutilPayant, string> = { higgsfield: "Higgsfield", heygen: "HeyGen" };

const passages = (c: ContexteOption) => (c.passagesSec?.length ? c.passagesSec : [c.dureeSec]).filter((d) => d > 0);

function devisHiggsfield(c: ContexteOption, t: Tarifs): number {
  return Math.ceil(creditsPourVideo(c.modele ?? "kling_video_edit", passages(c)) * t.prixCreditHiggsfieldCentimes - 1e-9);
}

function devisHeygen(c: ContexteOption, t: Tarifs): number {
  const angles = Math.max(0, Math.floor(c.angles ?? 2));
  return Math.ceil(angles * Math.ceil(Math.max(0, c.dureeSec)) * CENTIMES_USD_PAR_SECONDE_AVATAR_V * t.tauxUsdEur - 1e-9);
}

export const OPTIONS_PAYANTES: Record<IdOptionPayante, OptionPayante> = {
  "decor-ia": { id: "decor-ia", outil: "higgsfield", libelle: "Décor IA", estimer: devisHiggsfield },
  "effets-main-ultra": { id: "effets-main-ultra", outil: "higgsfield", libelle: "Effets main ultra réalistes", estimer: devisHiggsfield },
  "multicamera-avocat": { id: "multicamera-avocat", outil: "heygen", libelle: "Vidéo en 3 caméras", estimer: devisHeygen },
  "multicamera-facecam": { id: "multicamera-facecam", outil: "heygen", libelle: "Vidéo en 3 caméras", estimer: devisHeygen },
  // Lot K : un seul passage (3 à 8 s, découpé à 15 s au plus), Kling avec image de référence, sinon FLUX.
  "effet-realiste-ia": { id: "effet-realiste-ia", outil: "higgsfield", libelle: "Effet réaliste par IA", nommeeDansLaCarte: true, estimer: devisHiggsfield },
};

export const IDS_OPTIONS_PAYANTES = Object.keys(OPTIONS_PAYANTES) as IdOptionPayante[];

/**
 * Vérif V4 (règle de Will du 10/10) : options RETIRÉES. Le Décor IA est trop cher : il ne part JAMAIS. Aucune carte
 * n'est proposée, une carte déjà affichée (ancienne vidéo) ne se confirme plus, un accord déjà donné ne s'utilise plus.
 * Le rallumer demande de changer cette liste (décision de Will, pas un réglage).
 */
export const OPTIONS_RETIREES: readonly IdOptionPayante[] = ["decor-ia"];

export function optionRetiree(id: IdOptionPayante): boolean {
  return OPTIONS_RETIREES.includes(id);
}

export const MESSAGE_OPTION_RETIREE = "Le Décor IA n'est plus proposé : votre vrai décor est gardé, rien n'est dépensé.";

export function estOptionPayante(id: unknown): id is IdOptionPayante {
  return typeof id === "string" && id in OPTIONS_PAYANTES;
}

/** Estimation en centimes, avec les tarifs donnés (ou ceux par défaut). */
export function estimerOption(id: IdOptionPayante, contexte: ContexteOption, tarifs: Tarifs = TARIFS_PAR_DEFAUT): number {
  return Math.max(0, OPTIONS_PAYANTES[id].estimer(contexte, tarifs));
}
