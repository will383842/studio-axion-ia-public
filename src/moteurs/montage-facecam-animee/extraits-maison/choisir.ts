/** Extraits maison v4 (C4-U4.2) : choisir un extrait par les mots du thème. Pur : ni date, ni hasard non amorcé, ni appel payant.
 *  Aucune règle de droit ici : les candidats sont déjà filtrés par `plagesDisponibles`. */
import { cleUsageExtrait } from "@/briques/bibliotheque-video/types";
import { longueurExtrait } from "../images/preparation";
import { DUREE_MIN_EXTRAIT_V4_SEC, type ExtraitMaisonV4, type RechercheAxion } from "./types";

/** Candidat avec le texte et les mots-clés de sa plage (la conversion depuis `PlageExtrait` est faite en amont, C4-U4.5). */
export type CandidatChoixV4 = ExtraitMaisonV4 & { texte: string; motsCles: string[] };

export interface EntreeChoixV4 {
  recherche: RechercheAxion; dureeFenetreSec: number; videoId: string;
  candidats: readonly CandidatChoixV4[];
  /** Clés `cleUsageExtrait` déjà prises dans cette vidéo. */
  dejaPris: readonly string[];
  /** Clés des 10 dernières vidéos v4. */
  recents: readonly string[];
}

const sansAccent = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const mots = (s: string) => sansAccent(s).split(/[^\p{L}\p{N}]+/u).filter(Boolean);

/** Hachage simple (FNV-1a 32 bits), stable. */
function hache(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h >>> 0;
}

export function choisirExtraitV4(e: EntreeChoixV4): { extrait: CandidatChoixV4; debutSec: number; longueurSec: number } | null {
  const theme = [...new Set(e.recherche.motsCles.flatMap(mots))];
  if (!theme.length) return null;
  const pris = new Set(e.dejaPris), recents = new Set(e.recents);
  let meilleur: { c: CandidatChoixV4; score: number; tirage: number; longueurSec: number } | null = null;
  for (const c of e.candidats) {
    const dureePlage = c.finSec - c.debutSec;
    const longueurSec = longueurExtrait(e.dureeFenetreSec, dureePlage);
    if (!(dureePlage >= Math.max(DUREE_MIN_EXTRAIT_V4_SEC, longueurSec))) continue;
    const k = cleUsageExtrait(c.elementId, c.plageId);
    if (pris.has(k) || recents.has(k)) continue;
    const dansTexte = new Set(mots(c.texte)), dansCles = new Set(c.motsCles.flatMap(mots));
    let score = 0;
    for (const m of theme) { if (dansTexte.has(m)) score += 1; if (dansCles.has(m)) score += 2; }
    if (score < 1) continue;
    const tirage = hache(`${e.videoId}|${c.id}`);
    const mieux = !meilleur || score > meilleur.score
      || (score === meilleur.score && (tirage < meilleur.tirage || (tirage === meilleur.tirage && c.id < meilleur.c.id)));
    if (mieux) meilleur = { c, score, tirage, longueurSec };
  }
  if (!meilleur) return null;
  const { c, longueurSec } = meilleur;
  // Aucun horodatage de mot n'est connu : on part du début de la plage (qui contient le thème).
  const debutSec = Math.min(c.debutSec, c.finSec - longueurSec);
  return { extrait: c, debutSec, longueurSec };
}
