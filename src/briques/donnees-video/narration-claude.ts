/**
 * NARRATION ÉCRITE PAR CLAUDE (G4-06-a) — les deux bouts PURS : fabriquer la requête, lire la réponse.
 * Aucun appel : ce module ne reçoit ni client ni `AppelClaude`, n'enregistre aucun rôle, ne lit aucune clé de réglage,
 * ne pose aucun plafond ni réservation. Un seul import venu des fournisseurs, et c'est un TYPE.
 * Rien ne l'importe en production : le branchement (appel + plafond + clé) reste une fiche payante, en attente du oui de Williams.
 * Éteint par défaut : ce module ne s'exécute que si un appelant futur le choisit. 0 €.
 */
import type { RequeteClaude } from "@/fournisseurs/claude/client";
import { garderChiffres } from "./garde-chiffres";
import type { TableauDeBord } from "./types";

/** Même forme que `NarrationModele` (`narration-modele.ts`) ; redéclarée ici car le garde de ce module interdit de l'importer. */
export interface NarrationClaude {
  texte: string;
  phrases: string[];
  dureeEstimeeSec: number;
  remarques: string[];
}

/** Plafond de sortie proposé (CHIFFRAGE-CLAUDE-PAR-VIDEO-19-11.md § 2) : une narration de 156 mots ≈ 300 jetons. */
export const MAX_JETONS_NARRATION = 4000;
/** Taille maximale de la consigne, en caractères. */
export const CONSIGNE_NARRATION_MAX = 4000;

/** Débit et bornes de `narration-modele.ts` : 30 à 60 s à 2,6 mots/s. */
const MOTS_PAR_SECONDE = 2.6;
const MOTS_MIN = 78;
const MOTS_MAX = 156;

export const CONSIGNE_NARRATION = [
  "Tu écris la narration parlée d'une vidéo de tableau de bord, en français.",
  "Tu reçois un tableau de bord en JSON (version tableau-de-bord.v1) : titre, période, source, indicateurs, séries, comparaisons, alertes, calculs.",
  "",
  "Règles :",
  "- N'utilise que les nombres présents dans la donnée (valeurs d'indicateurs, points de séries, résultats de calculs). N'en invente aucun, n'en déduis aucun, ne fais aucun calcul de ton côté.",
  "- N'écris aucun autre nombre : ni année, ni date, ni numéro, sauf s'il figure dans la donnée.",
  "- Ne cite que ce que la donnée contient : pas de cause, pas de prévision, pas de conseil chiffré.",
  "- Raconte d'abord les indicateurs les plus importants, puis les comparaisons, puis les alertes, puis conclus par la source des données.",
  "- Écris comme on parle : phrases courtes, une idée par phrase, nombres écrits comme la voix les lit (virgule décimale).",
  `- Longueur totale : ${MOTS_MIN} à ${MOTS_MAX} mots (30 à 60 secondes de voix).`,
  "- Ne dis rien du visage, de la personne ou de la marque ; reste sur les chiffres.",
  "",
  'Sortie : uniquement un objet JSON de la forme { "phrases": string[] }, une narration par phrases, sans aucun texte autour.',
].join("\n");

/**
 * La requête : consigne en `systeme` (point de cache 5 min), la donnée en JSON canonique dans un seul message utilisateur, sans image.
 * Le modèle est PASSÉ en argument : aucune constante de modèle n'est importée.
 */
export function requeteNarrationClaude(donnee: TableauDeBord, modele: string): RequeteClaude {
  return {
    modele,
    maxTokens: MAX_JETONS_NARRATION,
    effort: "medium",
    systeme: [{ texte: CONSIGNE_NARRATION, cache: true }],
    messages: [{ role: "user", contenu: JSON.stringify(donnee) }],
    json: true,
  };
}

const compterMots = (t: string): number => t.split(/\s+/).filter(Boolean).length;

/** Retire une clôture Markdown entière autour de la réponse, comme le fait le client pour `json: true`. */
function sansCloture(texte: string): string {
  const m = /^\s*```[a-zA-Z]*\s*\n([\s\S]*?)\n?```\s*$/.exec(texte);
  return (m ? m[1] : texte).trim();
}

/**
 * Lit la réponse de Claude. Renvoie la même forme que `narrationModele` (`NarrationClaude`), ou `null` (JSON illisible, phrases absentes,
 * 78 à 156 mots non respectés, nombre hors donnée ou calcul faux selon `garderChiffres`) : l'appelant futur reprendra alors
 * la narration gratuite. Ne lève jamais.
 */
export function lireNarrationClaude(texte: string, donnee: TableauDeBord): NarrationClaude | null {
  try {
    if (typeof texte !== "string") return null;
    const brut: unknown = JSON.parse(sansCloture(texte));
    if (typeof brut !== "object" || brut === null || Array.isArray(brut)) return null;
    const phrases: unknown = (brut as { phrases?: unknown }).phrases;
    if (!Array.isArray(phrases) || phrases.length === 0) return null;
    if (!phrases.every((p): p is string => typeof p === "string" && p.trim() !== "")) return null;
    const lues = phrases.map((p) => p.trim());
    const dit = lues.join(" ");
    const mots = compterMots(dit);
    if (mots < MOTS_MIN || mots > MOTS_MAX) return null;
    if (!garderChiffres(donnee, { textesEcran: [], texteDit: dit }).ok) return null;
    return { texte: dit, phrases: lues, dureeEstimeeSec: Math.round((mots / MOTS_PAR_SECONDE) * 10) / 10, remarques: [] };
  } catch {
    return null;
  }
}
