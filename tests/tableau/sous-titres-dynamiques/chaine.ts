/**
 * La fiche RÉELLE de la vidéo v-6616b3800357 (« Réunion finie depuis trois jours… »), calée à un minutage réaliste,
 * mise en page dans un fond et un format, et ses sous-titres par la MÊME chaîne que la fabrication
 * (`segmentsSousTitresTableau` : groupes centraux → mélange → garde-fous du tableau → bande). Aucun appel payant.
 */
import { parametresComposition } from "../../../src/briques/composition/parametres";
import type { DonneesCalque } from "../../../src/briques/sous-titres/scene";
import { proprietesScenes } from "../../../src/briques/tableau-scene/proprietes";
import type { StyleTableau } from "../../../src/briques/tableau-scene/trois-styles/styles";
import type { MiseEnPageTableau as MiseBrique, ProprietesTableauScene, SceneCalee } from "../../../src/briques/tableau-scene/types";
import type { CommandeFabrication, IntensiteSousTitres, StyleResolu, ValeurStyleSousTitres } from "../../../src/domaine/types";
import { centreBandePct, commandeTableau, pagesDuStyle, plansTableau, RECETTE_COMPOSITION_TABLEAU, reseauxDuRatio, segmentsSousTitresTableau } from "../../../src/moteurs/montage-tableau/fabriquer";
import type { FicheTableau } from "../../../src/moteurs/montage-tableau/fiche";
import { formatSortie, type IdFormatSortie } from "../../../src/moteurs/montage-tableau/formats-sortie";
import { mettreEnPage, reseauxVerticaux, type MiseEnPageTableau } from "../../../src/moteurs/montage-tableau/mise-en-page";
import { bandeDe, bandeDuCalque, sousTitresTableau, supplementsSousTitresTableau, type BandeCalque, type SousTitresTableau } from "../../../src/moteurs/montage-tableau/sous-titres-tableau";
import { tempsReference3 } from "../../../src/moteurs/montage-tableau/temps-reference-3";
import { calerFicheTableau } from "../../../src/moteurs/montage-tableau/calage";
import { contexteBanc, ficheV6616, MOTS_DOULEUR_V6616 } from "../banc/fiches-banc";
import { motsRealistes } from "../reference-3/fiches";

export interface SortieSousTitres {
  fiche: FicheTableau;
  mise: MiseEnPageTableau;
  props: ProprietesTableauScene[];
  st: SousTitresTableau;
  c: CommandeFabrication;
  calque: DonneesCalque;
  bande: BandeCalque;
  largeur: number;
  hauteur: number;
}

export function sortieV6616(fond: StyleTableau, format: IdFormatSortie, o: { intensite?: IntensiteSousTitres; choisi?: StyleResolu<ValeurStyleSousTitres> } = {}): SortieSousTitres {
  // Comme la fabrication : la fiche lue dans le style (une page de plus si besoin), calée à un minutage réaliste.
  const lue = pagesDuStyle({ ...ficheV6616(), styleTableau: fond }) as FicheTableau;
  const mots = motsRealistes(lue, 20.5);
  const cal = calerFicheTableau(lue, mots, { contexte: contexteBanc(lue, MOTS_DOULEUR_V6616), dureeSec: mots.at(-1)!.finSec + 0.3 });
  if (!cal.ok) throw new Error(`calage refusé (${fond}) : ${cal.problemes.join(" | ")}`);
  const r = { fiche: cal.fiche, mots, elements: cal.elements };
  const fiche = r.fiche;
  const mise = mettreEnPage(fiche, format === "vertical" ? {} : { format });
  const props = proprietesScenes({ miseEnPage: mise as unknown as MiseBrique, scenes: fiche.scenes as SceneCalee[], heures: r.elements, stylo: fiche.stylo, mots: r.mots, temps3: tempsReference3(fiche, r.mots) });
  const fs = formatSortie(format);
  const verticale = format === "vertical";
  const reseaux = verticale ? reseauxVerticaux() : reseauxDuRatio(fs.ratio);
  const texte = fiche.scenes.map((s) => s.texteDit).join(" ");
  const dureeSec = props.at(-1)!.scene.finMs / 1000;
  const scenes = props.map((p) => ({ id: p.scene.id, debutSec: p.scene.debutMs / 1000, finSec: p.scene.finMs / 1000, cle: `apercu/${p.scene.id}.mp4` }));
  const bandeST = bandeDe(mise, fs.ratio, verticale, reseaux);
  const st = sousTitresTableau({ fiche, choisi: o.choisi, positionPct: centreBandePct(mise), bande: bandeST });
  const c = commandeTableau({ videoId: "v-6616b3800357", fiche, texteScript: texte, dureeSec, centreSousTitresPct: centreBandePct(mise), scenes, ratio: fs.ratio, ...(o.choisi ? { styleSousTitres: o.choisi } : {}), bandeSousTitres: bandeST, intensite: o.intensite ?? "equilibre" });
  // La même source que la fabrication : centre de la ligne, échelle, accents sans glissement, bande de fond.
  const supplements = supplementsSousTitresTableau({ st, mise, ratio: fs.ratio, verticale, dynamiques: true });
  const segments = segmentsSousTitresTableau({ c, st, dynamiques: true, texte, dureeSec, mots: r.mots, ratio: fs.ratio, reseaux, scenes, mise, supplements });
  const calque = parametresComposition(c, { ratio: fs.ratio, plans: plansTableau(scenes), segments, dureeSec, mots: r.mots, pistesDouble: { face: scenes[0].cle }, ...supplements }, RECETTE_COMPOSITION_TABLEAU).texte.sousTitres!;
  return { fiche, mise, props, st, c, calque, bande: bandeDuCalque(mise, calque), largeur: fs.largeur, hauteur: fs.hauteur };
}
