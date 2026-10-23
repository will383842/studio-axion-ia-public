/**
 * Outils des tests des compositions du tableau animé (TB-05) : une fiche d'exemple → calage sur des mots fabriqués
 * (aucune voix réelle) → mise en page → propriétés de chaque `TableauScene`.
 */
import type { MotHorodate } from "../../../src/domaine/types";
import { calerFicheTableau } from "../../../src/moteurs/montage-tableau/calage";
import type { FicheTableau } from "../../../src/moteurs/montage-tableau/fiche";
import { mettreEnPage } from "../../../src/moteurs/montage-tableau/mise-en-page";
import { proprietesScenes } from "../../../studio-rendu/compositions/tableau/proprietes";
import type { ProprietesTableauScene } from "../../../studio-rendu/compositions/tableau/types";
import { contexteExemple } from "../regles/exemples";

/** Mots horodatés fabriqués : un jeton par mot du texte dit, à débit régulier, une pause entre les scènes. */
export function motsFabriques(fiche: FicheTableau, parMotMs = 330, pauseMs = 250): MotHorodate[] {
  const res: MotHorodate[] = [];
  let t = 120;
  for (const s of fiche.scenes) {
    for (const mot of s.texteDit.split(/\s+/).filter(Boolean)) {
      res.push({ mot, debutSec: t / 1000, finSec: (t + parMotMs - 40) / 1000 });
      t += parMotMs;
    }
    t += pauseMs;
  }
  return res;
}

/** Contenus des bulles de preuve des exemples (phrase testée fictive, date du test). */
export function preuvesExemple(fiche: FicheTableau): Record<string, { phrase: string; testeLe: string }> {
  return Object.fromEntries(fiche.scenes.flatMap((s) => s.elements).filter((e) => e.type === "preuve").map((e) => [e.id, { phrase: "Posez-moi trois questions", testeLe: "2026-10-09" }]));
}

/** Propriétés de toutes les scènes d'une fiche d'exemple. */
export function scenesExemple(fiche: FicheTableau, importants: Record<string, string[]> = {}): ProprietesTableauScene[] {
  const r = calerFicheTableau(fiche, motsFabriques(fiche), { contexte: contexteExemple(fiche) });
  if (!r.ok) throw new Error(r.problemes.join("\n"));
  const preuves = preuvesExemple(fiche);
  return proprietesScenes({ miseEnPage: mettreEnPage(r.fiche, { preuves }), scenes: r.fiche.scenes, heures: r.elements, stylo: r.fiche.stylo, importants, preuves });
}
