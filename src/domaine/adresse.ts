/**
 * TUTOIEMENT / VOUVOIEMENT (moteur avocat B.0 §15). PUR, importable côté client.
 * L'adresse est choisie à chaque vidéo ; le défaut vient de « Ma façon de parler ».
 * Un texte collé par Will n'est jamais réécrit : on SIGNALE seulement un mélange de « tu » et de « vous ».
 */
import type { Adresse } from "./types";

/** Défaut de « Ma façon de parler » (pas de nouveau réglage : `tutoiement` y existe déjà). */
export function adresseDepuisFacon(tutoiement: boolean | undefined): Adresse {
  return tutoiement ? "tu" : "vous";
}

/** Règle d'écriture générée depuis l'adresse (remplace « Vouvoiement du spectateur » des règles communes). */
export function regleAdresse(adresse: Adresse): string {
  return adresse === "tu" ? "Tutoiement du spectateur (« tu »), du début à la fin." : "Vouvoiement du spectateur (« vous »), du début à la fin.";
}

// Formes propres au tutoiement. « te » et « t' » sont ambigus seuls ; on les garde car ils ne servent qu'au tutoiement.
const FORMES_TU = ["tu", "toi", "te", "t'", "ton", "ta", "tes", "tien", "tienne", "tiens", "tiennes"];
const FORMES_VOUS = ["vous", "votre", "vos", "vôtre", "vôtres"];

/**
 * Faux amis du tutoiement (E2E-2 parcours n° 22) : « ton » NOM (« votre ton », « le ton », « un ton juste ») et
 * « tiens » de « je tiens à » ne tutoient personne. Ils sont retirés du compte.
 */
const FAUX_AMIS_TU = /(?<![\p{L}'])(?:(?:le|un|du|au|ce|votre|notre|leur|mon|son|quel|même|bon|bas|haut)\s+ton|je\s+(?:ne\s+)?tiens)(?![\p{L}])/gu;

function compterFauxAmisTu(texte: string): number {
  return (texte.toLowerCase().replace(/[’]/g, "'").match(FAUX_AMIS_TU) ?? []).length;
}

function compter(texte: string, formes: string[]): number {
  const minuscule = texte.toLowerCase().replace(/[’]/g, "'");
  let n = 0;
  for (const f of formes) {
    const motif = f.endsWith("'") ? `(?<![\\p{L}])${f}` : `(?<![\\p{L}'])${f}(?![\\p{L}])`;
    n += (minuscule.match(new RegExp(motif, "gu")) ?? []).length;
  }
  return n;
}

export interface AnalyseAdresse {
  tu: number;
  vous: number;
  /** Adresse dominante du texte (null si aucune). */
  dominante: Adresse | null;
  /** Le texte mêle les deux : alerte NON bloquante. */
  melange: boolean;
}

/** Compte les formes de « tu » et de « vous » d'un texte et signale un mélange. */
export function analyserAdresse(texte: string): AnalyseAdresse {
  const tu = Math.max(0, compter(texte, FORMES_TU) - compterFauxAmisTu(texte));
  const vous = compter(texte, FORMES_VOUS);
  return { tu, vous, dominante: tu === 0 && vous === 0 ? null : tu > vous ? "tu" : "vous", melange: tu > 0 && vous > 0 };
}

/** Message d'alerte (vouvoiement, sans jargon) quand le texte ne suit pas l'adresse choisie ; null sinon. */
export function alerteAdresse(texte: string, adresse: Adresse): string | null {
  const a = analyserAdresse(texte);
  if (a.melange) return "Le texte mélange « tu » et « vous ». Vérifiez que c'est voulu.";
  if (a.dominante && a.dominante !== adresse) return adresse === "tu" ? "Le texte vouvoie, alors que la vidéo est réglée sur « tu »." : "Le texte tutoie, alors que la vidéo est réglée sur « vous ».";
  return null;
}
