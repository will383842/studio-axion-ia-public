/** La fiche de la vidéo v-fc3ac0c1d171 et ses propriétés de rendu (tests et rendu réel de la page 2). */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { proprietesScenes } from "../../../src/briques/tableau-scene/proprietes";
import type { StyleTableau } from "../../../src/briques/tableau-scene/trois-styles/styles";
import type { MiseEnPageTableau as MiseBrique, ProprietesTableauScene, SceneCalee } from "../../../src/briques/tableau-scene/types";
import { calerFicheTableau } from "../../../src/moteurs/montage-tableau/calage";
import { remettreEnForme } from "../../../src/moteurs/montage-tableau/decoupage";
import { pagesDuStyle } from "../../../src/moteurs/montage-tableau/fabriquer";
import type { FicheTableau } from "../../../src/moteurs/montage-tableau/fiche";
import { mettreEnPage } from "../../../src/moteurs/montage-tableau/mise-en-page";
import { tempsReference3 } from "../../../src/moteurs/montage-tableau/temps-reference-3";
import { contexteBanc, MOTS_DOULEUR_V6616 } from "../banc/fiches-banc";
import { motsRealistes } from "../reference-3/fiches";

/** La fiche de la vidéo v-fc3ac0c1d171 : le témoin v-6616b3800357, page 2 remplacée par le découpage réel. */
export function ficheVfc3(): FicheTableau {
  const brute = JSON.parse(readFileSync(join(__dirname, "..", "temoins", "fiche-temoin-v-fc3ac0c1d171-reference-3.json"), "utf8")) as FicheTableau;
  return remettreEnForme(brute, { motsDouleur: MOTS_DOULEUR_V6616 });
}

/** Les propriétés de rendu (le vrai chemin : style posé, pages refaites, calage, mise en page, heures fines). */
export function proprietesVfc3(style: StyleTableau, format: "vertical" | "portrait" | "carre" | "horizontal"): ProprietesTableauScene[] {
  const f = pagesDuStyle({ ...ficheVfc3(), styleTableau: style }) as FicheTableau;
  const mots = motsRealistes(f);
  const r = calerFicheTableau(f, mots, { contexte: contexteBanc(f, MOTS_DOULEUR_V6616), dureeSec: mots.at(-1)!.finSec + 0.3 });
  if (!r.ok) throw new Error(r.problemes.join(" | "));
  const m = mettreEnPage(r.fiche, format === "vertical" ? {} : { format });
  return proprietesScenes({ miseEnPage: m as unknown as MiseBrique, scenes: r.fiche.scenes as SceneCalee[], heures: r.elements, stylo: r.fiche.stylo, mots, temps3: tempsReference3(r.fiche, mots) });
}

