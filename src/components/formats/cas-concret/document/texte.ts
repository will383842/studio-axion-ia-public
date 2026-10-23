/**
 * TEXTE CORRIGÉ DU DOCUMENT PROMIS (P2S, P2R point 8). PUR.
 *
 * Le studio écrit le premier jet (`texteSource`), Will le corrige dans une case de texte puis le valide. Cette pièce
 * contrôle la correction (aucun chiffre sans source, aucun prix, aucun mot interdit, aucun nom qui n'est pas déjà dans
 * le premier jet, deux pages au plus) et la découpe en sections pour la page imprimable. Rien n'est envoyé.
 */
import { MOTS_INTERDITS_FORMAT, nomsPropres } from "@/moteurs/montage-cas-concret/regles";

/** Deux pages A4 au plus : budget de texte, en caractères, pour tout le document. */
export const BUDGET_DEUX_PAGES = 4600;

export const PHRASES_DOCUMENT = Object.freeze({
  vide: "Le document est vide : écrivez-le ou reprenez le premier jet.",
  troplong: "Le document doit tenir sur deux pages au plus : raccourcissez-le.",
  prix: "Un document promis ne donne aucun prix : retirez-le.",
  chiffre: "Un chiffre n'a pas de source dans le premier jet : retirez-le.",
  nom: "Un nom propre n'est pas dans le premier jet : retirez-le (aucun client nommé).",
  reservation: "Le document propose le diagnostic gratuit : ne dites pas « réservez », reformulez.",
});

const MOTIF_PRIX = /€|\beuros?\b|\bprix\b|\btarifs?\b|\bHT\b|\bTTC\b/i;
const MOTIF_RESERVATION = /r[ée]servez/i;

const nombres = (t: string): string[] => t.match(/\d+(?:[.,]\d+)?/g) ?? [];
const minuscules = (t: string): string => t.toLowerCase();

/** Les phrases qui empêchent d'enregistrer la correction ; vide : rien ne s'y oppose. */
export function controlerTexteDocument(texte: string, source: string): string[] {
  const phrases: string[] = [];
  const t = texte.trim();
  if (!t) return [PHRASES_DOCUMENT.vide];
  if (t.length > BUDGET_DEUX_PAGES) phrases.push(PHRASES_DOCUMENT.troplong);
  if (MOTIF_PRIX.test(t) && !MOTIF_PRIX.test(source)) phrases.push(PHRASES_DOCUMENT.prix);
  const connus = new Set(nombres(source));
  if (nombres(t).some((n) => !connus.has(n))) phrases.push(PHRASES_DOCUMENT.chiffre);
  const interdit = MOTS_INTERDITS_FORMAT.find((m) => minuscules(t).includes(minuscules(m)) && !minuscules(source).includes(minuscules(m)));
  if (interdit) phrases.push("Un mot n'a pas sa place dans un document client : retirez-le.");
  if (MOTIF_RESERVATION.test(t) && !MOTIF_RESERVATION.test(source)) phrases.push(PHRASES_DOCUMENT.reservation);
  const noms = new Set(nomsPropres(source).map(minuscules));
  if (nomsPropres(t).some((n) => !noms.has(minuscules(n)))) phrases.push(PHRASES_DOCUMENT.nom);
  return phrases;
}

export interface SectionTexte {
  /** Titre `##` ; absent pour l'en-tête. */
  titre?: string;
  lignes: string[];
}

export interface TexteStructure {
  titre: string;
  sections: SectionTexte[];
}

/** Découpe le texte source : `# titre`, puis des sections `## titre` suivies de leurs lignes. */
export function structurerTexte(texte: string): TexteStructure {
  const sections: SectionTexte[] = [{ lignes: [] }];
  let titre = "";
  for (const brute of texte.split("\n")) {
    const l = brute.trimEnd();
    if (l.startsWith("## ")) sections.push({ titre: l.slice(3).trim(), lignes: [] });
    else if (l.startsWith("# ") && !titre) titre = l.slice(2).trim();
    else if (l.trim()) sections[sections.length - 1].lignes.push(l.trim());
  }
  return { titre, sections };
}
