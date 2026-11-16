/**
 * MOT-CLÉ DE RECHERCHE À L'ÉCRAN EN 0-3 s (X1-13) : parmi les mots DITS dans les 3 premières secondes,
 * choisit le nom le plus proche du sujet de la vidéo, sinon « rien ».
 * Pur : aucun service, aucun réglage, aucune horloge, aucun hasard. Non branché (rien ne l'appelle).
 * Honnêteté : le texte renvoyé est un mot réellement dit (ponctuation retirée), jamais reformulé.
 * Argent exclu (D4-17) ; mots outils et négations refusés (listes existantes des sous-titres).
 */
import type { MotFait } from "../faits-script/types";
import { MOTS_FORTS, MOTS_OUTILS, estNombre, normaliser } from "../sous-titres/typographie";

/** Éteint par défaut : seul `true` allume. */
export const MOT_CLE_RECHERCHE_ACTIF = false;
/** Fenêtre : le mot doit commencer au plus tard à 3 s. */
export const FENETRE_MOT_CLE_MS = 3000;

export type MotCleRecherche = { type: "rien" } | { type: "mot"; texte: string; debutMs: number; finMs: number };

const RIEN: MotCleRecherche = { type: "rien" };
const MOTS_ARGENT = /€|euro|prix|tarif|cout|coût|payant|remise|gratuit/;
const LONGUEUR_MIN = 4;
const RACINE = 5;

const net = (s: string) => normaliser(s).replace(/[^\p{L}\p{N}]+/gu, "");
const sansAccent = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function interdit(brut: string): boolean {
  const n = net(brut);
  if (n.length < LONGUEUR_MIN) return true;
  if (/\d/.test(n) || estNombre(brut)) return true;
  if (MOTS_OUTILS.has(n) || MOTS_FORTS.has(n)) return true;
  return MOTS_ARGENT.test(sansAccent(brut));
}

/** 2 = mot du sujet, 1 = même racine (pluriel, accord), 0 = étranger au sujet. */
function proximite(mot: string, sujet: readonly string[]): number {
  const m = sansAccent(mot);
  let meilleur = 0;
  for (const s of sujet) {
    if (s === m) return 2;
    if (m.length >= RACINE && s.length >= RACINE && m.slice(0, RACINE) === s.slice(0, RACINE)) meilleur = 1;
  }
  return meilleur;
}

export function motCleDeRecherche(mots: readonly MotFait[], sujet: string): MotCleRecherche {
  try {
    if (!Array.isArray(mots) || mots.length === 0 || typeof sujet !== "string") return RIEN;
    const motsSujet = sujet.split(/\s+/).map((t) => sansAccent(net(t))).filter((t) => t.length >= LONGUEUR_MIN);
    if (motsSujet.length === 0) return RIEN;
    let meilleur: { texte: string; debutMs: number; finMs: number; score: number } | null = null;
    for (const mot of mots) {
      if (!(mot.debutMs <= FENETRE_MOT_CLE_MS) || interdit(mot.texte)) continue;
      const texte = mot.texte.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
      const score = proximite(texte, motsSujet);
      if (score === 0) continue;
      if (!meilleur || score > meilleur.score || (score === meilleur.score && mot.debutMs < meilleur.debutMs)) {
        meilleur = { texte, debutMs: mot.debutMs, finMs: mot.finMs, score };
      }
    }
    return meilleur ? { type: "mot", texte: meilleur.texte, debutMs: meilleur.debutMs, finMs: meilleur.finMs } : RIEN;
  } catch {
    return RIEN;
  }
}
