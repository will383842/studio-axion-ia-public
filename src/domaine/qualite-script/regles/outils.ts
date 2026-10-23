/**
 * SOCLE QUALITÉ · outils communs des règles : fabrication d'un résultat, lexiques partagés. PUR.
 * Les lexiques se lisent sur le texte NORMALISÉ (minuscules, sans accents : `controles-script/texte.ts`).
 */
import { motsPleins, normaliser, racine } from "@/domaine/controles-script/texte";
import type { Contexte, NiveauVise, ResultatRegle, Statut, Theme } from "../types";

/** Un résultat ; le niveau visé peut être changé par la recette (jamais sans raison). */
export function resultat(c: Contexte, code: string, theme: Theme, niveau: NiveauVise, statut: Statut, message: string, plus: Partial<ResultatRegle> = {}): ResultatRegle {
  const ecart = c.recette.niveaux?.[code];
  const niveauVise = ecart && ecart.raison.trim() ? ecart.valeur : niveau;
  return { code, theme, niveauVise, statut, message, ...plus };
}

/** Nombres dits en lettres (sans « un », « une » : trop fréquents comme articles). */
export const NOMBRES_EN_LETTRES =
  "deux|trois|quatre|cinq|six|sept|huit|neuf|dix|onze|douze|treize|quatorze|quinze|seize|vingt|trente|quarante|cinquante|soixante|cent|cents|mille|million|millions|moitie|double|triple|demi";

/** Un nombre : chiffres ou nombre en lettres. */
export const NOMBRE = new RegExp(`(?:^|[^\\p{L}\\p{N}])(?:\\d+(?:[.,]\\d+)?|${NOMBRES_EN_LETTRES})(?![\\p{L}\\p{N}])`, "u");

/** Unités d'un gain concret (temps, argent, quantités du métier). */
const UNITES =
  "heures?|h|minutes?|min|secondes?|jours?|semaines?|mois|ans?|annees?|euros?|€|%|pour cent|lignes?|clients?|rendez-vous|devis|factures?|candidatures?|dossiers?|e-mails?|mails?|messages?|relances?|appels?|pages?|fois|erreurs?|taches?|personnes?|salaries?|prospects?|commandes?|contrats?|etapes?";

/** Un gain concret : un nombre suivi (à un mot près) d'une unité. « six lignes », « quinze minutes », « 3 h ». */
export const GAIN = new RegExp(`(?:^|[^\\p{L}\\p{N}])(?:\\d+(?:[.,]\\d+)?|${NOMBRES_EN_LETTRES})\\s+(?:[\\p{L}'-]+\\s+)?(?:${UNITES})(?![\\p{L}])`, "u");

/** Vocabulaire de l'entreprise du spectateur (métier, taille TPE/PME/ETI/grande entreprise, fonction, situation). */
export const ENTREPRISE =
  /(?:^|[^a-z])(entreprises?|pme|tpe|eti|grands? groupes?|grandes? entreprises?|groupes?|directeurs?|directrices?|responsables?|gerants?|dsi|daf|drh|dg|societes?|equipes?|salaries?|collaborat\w*|recrut\w*|clients?|dirigeants?|patrons?|chefs? d'entreprise|cabinets?|artisans?|commerces?|commer[cç]ants?|devis|factur\w*|chantiers?|assistantes?|comptab\w*|commerciaux|commercial|fournisseurs?|candidat\w*|rh)(?=$|[^a-z])/;

/** Racines des mots pleins d'un texte (sans les nombres en lettres : « trois » ne lie pas deux idées). */
export function racinesPleines(texte: string): Set<string> {
  const nombres = new Set(NOMBRES_EN_LETTRES.split("|"));
  return new Set(motsPleins(texte).filter((m) => !nombres.has(m)).map(racine).filter((r) => r.length >= 4));
}

/** Racines communes à deux textes. */
export function racinesCommunes(a: string, b: string): string[] {
  const rb = racinesPleines(b);
  return [...racinesPleines(a)].filter((r) => rb.has(r));
}

export const norm = normaliser;
