// Doublons de mots et cibles partagées : PUR (aucune lecture, aucune écriture, aucun envoi).
// Deux mots qui ne diffèrent que par la casse ou les accents sont le MÊME mot (même règle que `normaliserMot`).
import { normaliserMot } from "./mot-normalise";

export type EtatMotDoublon = "brouillon" | "actif" | "pause";

interface LigneRegistre {
  readonly mot: string;
  readonly etat: string;
}
interface LiaisonCible {
  readonly mot: string;
  readonly codeCible: string;
  readonly actif: boolean;
}

/** Clé de comparaison d'un mot : normalisée (casse, accents) ; à défaut, le texte nettoyé en majuscules sans accents. */
export function cleDoublon(mot: string): string {
  return normaliserMot(mot) ?? mot.normalize("NFKC").trim().normalize("NFD").replace(/\p{M}/gu, "").toUpperCase();
}

/** État d'un mot d'après ses lignes de registre : actif si un compte l'est, sinon pause (pause automatique comprise), sinon brouillon. */
function etatDesLignes(lignes: readonly LigneRegistre[]): EtatMotDoublon {
  if (lignes.some((l) => l.etat === "actif")) return "actif";
  if (lignes.some((l) => l.etat === "pause" || l.etat === "pause_auto")) return "pause";
  return "brouillon";
}

/** `null` si le mot n'existe ni au tableau (liaisons actives) ni au registre ; sinon son état. */
export function etatSiMotExiste(mot: string, liaisons: readonly LiaisonCible[], registre: readonly LigneRegistre[]): EtatMotDoublon | null {
  const k = cleDoublon(mot);
  const lignes = registre.filter((l) => cleDoublon(l.mot) === k);
  if (lignes.length === 0 && !liaisons.some((l) => l.actif && cleDoublon(l.mot) === k)) return null;
  return etatDesLignes(lignes);
}

/** Un mot a-t-il au moins un compte actif au registre (ligne locale ou posée chez Zernio) ? */
export const motEstActif = (mot: string, registre: readonly LigneRegistre[]): boolean => {
  const k = cleDoublon(mot);
  return registre.some((l) => l.etat === "actif" && cleDoublon(l.mot) === k);
};

/** Les AUTRES mots ACTIFS reliés à cette cible (triés, sans doublon). */
export function motsActifsSurCible(codeCible: string, motCourant: string, liaisons: readonly LiaisonCible[], registre: readonly LigneRegistre[]): string[] {
  const courant = cleDoublon(motCourant);
  const sur = new Set<string>();
  for (const l of liaisons) if (l.actif && l.codeCible === codeCible) sur.add(cleDoublon(l.mot));
  return [...sur].filter((m) => m !== courant && motEstActif(m, registre)).sort();
}

export const phraseMotExiste = (etat: EtatMotDoublon): string => `Ce mot existe déjà (état : ${etat}). Ouvrez sa fiche pour le modifier.`;
export const PHRASE_MOT_ACTIF_PAUSE_D_ABORD = "Ce mot est actif : mettez-le en pause avant de changer sa cible.";
export const phraseCiblePartagee = (mots: readonly string[]): string =>
  mots.length === 0 ? "" : ` Attention : cette cible est déjà utilisée par ${mots.length > 1 ? "d'autres mots actifs" : "un autre mot actif"} (${mots.join(", ")}). Une même personne pourrait recevoir deux guides différents.`;
