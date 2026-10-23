/**
 * Sous-titres de REPLI du téléchargement groupé (vérification E2E n° 1, problème n° 6). PUR.
 *
 * Quand une vidéo n'a pas encore de sous-titres alignés (fabrication simulée, moteur qui n'en pose pas), les fichiers
 * .srt et .vtt du zip étaient vides. Ils sont désormais tirés du TEXTE AFFICHÉ de la version, mot pour mot, découpé en
 * groupes courts (une phrase, ou 7 mots au plus) et répartis sur la durée de la vidéo au prorata du nombre de mots.
 */
import type { SegmentSousTitres } from "@/domaine/types";

const MOTS_PAR_GROUPE = 7;
/** Débit de repli quand aucune durée n'est connue (≈ 2,5 mots par seconde). */
const MOTS_PAR_SECONDE = 2.5;

/** Groupes de mots : on coupe à chaque fin de phrase, et au plus tous les 7 mots. */
function groupes(texte: string): string[][] {
  const phrases = texte
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?…])\s+/)
    .map((p) => p.trim())
    .filter(Boolean);
  const out: string[][] = [];
  for (const p of phrases) {
    const mots = p.split(" ").filter(Boolean);
    for (let i = 0; i < mots.length; i += MOTS_PAR_GROUPE) out.push(mots.slice(i, i + MOTS_PAR_GROUPE));
  }
  return out;
}

/** Sous-titres tirés du texte affiché, répartis sur `dureeSec` (sinon une durée estimée au débit parlé). */
export function sousTitresDepuisTexte(texte: string, dureeSec?: number): SegmentSousTitres[] {
  const gs = groupes(texte);
  const total = gs.reduce((n, g) => n + g.length, 0);
  if (!total) return [];
  const duree = dureeSec && dureeSec > 0 ? dureeSec : total / MOTS_PAR_SECONDE;
  const parMot = duree / total;
  let t = 0;
  return gs.map((g, i) => {
    const debut = t;
    const mots = g.map((mot, j) => ({ mot, debutSec: debut + j * parMot, finSec: debut + (j + 1) * parMot }));
    t = debut + g.length * parMot;
    return { id: `repli-${i + 1}`, debutSec: debut, finSec: t, mots };
  });
}

/** La vidéo a-t-elle des sous-titres exportables (au moins un groupe avec des mots et une durée) ? */
export function sousTitresUtilisables(segments: SegmentSousTitres[] | undefined): segments is SegmentSousTitres[] {
  return !!segments?.some((s) => s.mots.length > 0 && s.finSec - s.debutSec > 0.001);
}
