/**
 * C2-U8 : noms d'outils en étiquette dans la ligne des sous-titres (texte seul, jamais de logo). PUR : aucun alias
 * d'import de l'application, ni React, ni Remotion (lu par le rendu). Éteint par défaut : seul un style portant `texteEcran.outils ===
 * "etiquette"` appelle `motsOutils`. Aucune adresse, aucune image, aucune couleur de marque.
 *
 * L'`id` de chaque outil est STABLE et ne change jamais : un futur champ facultatif `logoId` (C8-L12) s'y accrochera.
 */
import { PALETTE } from "../charte/axion-2026";
import { normaliser } from "./typographie";

/** Documente l'état : rien ne l'allume ici, le seul déclencheur est le champ `outils` du style. */
export const ETIQUETTE_OUTIL_DANS_LIGNE_ACTIF = false;

export interface NomOutil {
  /** Minuscules, sans espace, stable à jamais. */
  id: string;
  /** Nom tel qu'on l'écrit. */
  affiche: string;
  /** Écritures reconnues, chacune une suite de mots normalisés (sans casse, accent ni ponctuation). */
  formes: string[][];
  /** Mot courant du français : exige la majuscule d'origine et ne compte pas en début de phrase. */
  ambigu?: true;
}

const outil = (id: string, affiche: string, formes: string[][], ambigu?: true): NomOutil => Object.freeze({ id, affiche, formes, ...(ambigu ? { ambigu } : {}) });

export const NOMS_OUTILS: readonly NomOutil[] = Object.freeze([
  outil("chatgpt", "ChatGPT", [["chatgpt"]]),
  outil("claude", "Claude", [["claude"]], true),
  outil("excel", "Excel", [["excel"]]),
  outil("notion", "Notion", [["notion"]]),
  outil("canva", "Canva", [["canva"]]),
  outil("zapier", "Zapier", [["zapier"]]),
  outil("make", "Make", [["make"]], true),
  outil("gmail", "Gmail", [["gmail"]]),
  outil("outlook", "Outlook", [["outlook"]]),
  outil("google-sheets", "Google Sheets", [["google", "sheets"]]),
  outil("hubspot", "HubSpot", [["hubspot"]]),
  outil("slack", "Slack", [["slack"]]),
  outil("teams", "Teams", [["teams"]], true),
  outil("whatsapp", "WhatsApp", [["whatsapp"]]),
  outil("gemini", "Gemini", [["gemini"]]),
  outil("copilot", "Copilot", [["copilot"]]),
  outil("mistral", "Mistral", [["mistral"]]),
  outil("perplexity", "Perplexity", [["perplexity"]]),
  outil("pennylane", "Pennylane", [["pennylane"]]),
  outil("qonto", "Qonto", [["qonto"]]),
]);

/**
 * Pastille de l'étiquette (sur la ligne). Noir sur la ligne, lettre ivoire, filet gris sur noir : paires de la charte
 * (`[ivoire, noir]`, `[grisSurNoir, noir]`). Marges en em (taille de la lettre), un peu plus larges que la plaque du pavé
 * pour que le nom se lise comme une pièce rapportée ; filet de 2 px, lisible sans alourdir.
 */
export const ETIQUETTE = { fond: PALETTE.noir, texte: PALETTE.ivoire, bord: PALETTE.grisSurNoir, margeXEm: 0.22, margeYEm: 0.06, rayonEm: 0.3, bordPx: 2 };

const sansAccent = (m: string) => normaliser(m).normalize("NFD").replace(/[̀-ͯ]/g, "");
const FIN_PHRASE = /[.!?…]["»”]?$/;

/** Début de phrase par défaut : premier mot du segment, ou mot qui suit un `.`, `!` ou `?`. */
function debutParDefaut(mots: { mot: string }[]): (k: number) => boolean {
  return (k) => k === 0 || FIN_PHRASE.test(mots[k - 1].mot.trim());
}

/**
 * Nom d'outil reconnu dans un groupe : au plus UNE étiquette, la première trouvée. Un nom en plusieurs mots ne compte
 * que s'il tient en entier dans le groupe.
 */
export function motsOutils(segment: { mots: { mot: string }[] }, debutDePhrase?: (k: number) => boolean): { debut: number; longueur: number; id: string }[] {
  const { mots } = segment;
  const formes = mots.map((m) => sansAccent(m.mot));
  const debutPhrase = debutDePhrase ?? debutParDefaut(mots);
  for (let k = 0; k < mots.length; k++) {
    for (const o of NOMS_OUTILS) {
      for (const f of o.formes) {
        if (k + f.length > mots.length || !f.every((x, j) => formes[k + j] === x)) continue;
        if (o.ambigu && (debutPhrase(k) || !/^\P{L}*\p{Lu}/u.test(mots[k].mot))) continue;
        return [{ debut: k, longueur: f.length, id: o.id }];
      }
    }
  }
  return [];
}

/**
 * C2-U9 : étiquette d'outil AUTONOME, en grand, à la première mention d'un outil (texte seul, aucun logo : le logo viendra
 * par `logoId`, C8-L12). Éteinte : cette constante passe à `true` par une PR d'une ligne, après le geste de Williams et un
 * rendu témoin. Tant qu'elle vaut `false`, `etiquettesAutonomes` ne rend rien et aucun champ n'est posé : rendu identique.
 */
export const ETIQUETTE_OUTIL_AUTONOME = false;

/** Réglages (secondes ; taille en px à 1 080 de large). Pastille aux couleurs de `ETIQUETTE` (paires de la charte). */
export const ETIQUETTE_AUTONOME = {
  dureeSec: 1.2,
  fonduSec: 0.2,
  /** Pas avant 0,8 s : même règle que le bandeau, le spectateur voit d'abord l'image. */
  debutMinSec: 0.8,
  maxParVideo: 3,
  tailleBasePx: 96,
  margeXEm: 0.3,
  margeYEm: 0.14,
  rayonEm: 0.3,
} as const;

export interface EtiquetteOutilPosee {
  /** `id` stable de l'outil (`NomOutil.id`). */
  id: string;
  /** Nom en capitales, tel qu'il s'écrit. */
  texte: string;
  debutSec: number;
  finSec: number;
}

const rencontre = (debut: number, fin: number, a?: { debutSec: number; finSec: number }) => !!a && debut < a.finSec && fin > a.debutSec;

/**
 * Pose les étiquettes : une par outil et par vidéo (la première mention qui peut s'afficher), au plus 3, jamais avant
 * 0,8 s, ni pendant le bandeau, ni pendant l'encadré d'ouverture, ni en chevauchement d'une autre étiquette, ni au-delà
 * de la vidéo. `actif` vaut `ETIQUETTE_OUTIL_AUTONOME` par défaut : éteint, la liste est vide.
 */
export function etiquettesAutonomes(
  segments: { debutSec: number; finSec: number; mots: { mot: string; debutSec?: number }[] }[],
  dureeSec: number,
  options: { actif?: boolean; bandeau?: { debutSec: number; finSec: number }; ouvertureFinSec?: number } = {},
): EtiquetteOutilPosee[] {
  if (!(options.actif ?? ETIQUETTE_OUTIL_AUTONOME)) return [];
  const posees: EtiquetteOutilPosee[] = [];
  for (const s of segments) {
    if (posees.length >= ETIQUETTE_AUTONOME.maxParVideo) break;
    const trouve = motsOutils(s)[0];
    if (!trouve || posees.some((p) => p.id === trouve.id)) continue;
    const debutSec = Math.max(ETIQUETTE_AUTONOME.debutMinSec, s.mots[trouve.debut].debutSec ?? s.debutSec);
    const finSec = debutSec + ETIQUETTE_AUTONOME.dureeSec;
    if (finSec > dureeSec + 1e-9) continue;
    if (rencontre(debutSec, finSec, options.bandeau)) continue;
    if (options.ouvertureFinSec !== undefined && debutSec < options.ouvertureFinSec - 1e-6) continue;
    if (posees.some((p) => rencontre(debutSec, finSec, p))) continue;
    const o = NOMS_OUTILS.find((n) => n.id === trouve.id)!;
    posees.push({ id: o.id, texte: o.affiche.toUpperCase(), debutSec: +debutSec.toFixed(3), finSec: +finSec.toFixed(3) });
  }
  return posees;
}
