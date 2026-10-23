/**
 * Calques des sous-titres des AUTRES formats (avocat, face caméra, image → vidéo), sérialisés au caractère près : les
 * données du calque (`parametresComposition`, `donneesCalque`) et, pour chaque groupe à trois instants, ce que le moteur
 * dessine (`elementDe`) et le CSS posé (`cssElement`). Calculé à l'identique sur la base de la pile (avant le tableau) et
 * sur cette branche : le témoin `autres-formats.temoin.json` doit rester égal (voir `design-central.test.ts`). N'emploie
 * que des fonctions présentes avant la pile. PUR.
 */
import { parametresComposition } from "../../../src/briques/composition/parametres";
import { cssElement, donneesCalque, elementDe, type DonneesCalque } from "../../../src/briques/sous-titres";
import type { CommandeFabrication, SegmentSousTitres } from "../../../src/domaine/types";
import { decorsCatalogue } from "../../../src/donnees/decors-catalogue";
import { HABILLAGE_AVOCAT, PROFIL_SON_AVOCAT, STYLE_SOUS_TITRES_AVOCAT } from "../../../src/donnees/elements-avocat";
import { RECETTE_COMPOSITION_AVOCAT } from "../../../src/moteurs/montage-avocat/recette-composition";
import { STYLE_SOUS_TITRES_IV } from "../../../src/moteurs/montage-image-video/sous-titres-varies";

const MAINTENANT = "2026-10-02T08:00:00.000Z";
const mot = (m: string, d: number, f: number) => ({ mot: m, debutSec: d, finSec: f });

/** Des groupes de chaque sorte : base, mot en valeur, Impact incliné, Bandeau, soulignement, importance 3. */
export const SEGMENTS_TEMOIN: SegmentSousTitres[] = [
  { id: "g1", debutSec: 0.1, finSec: 0.9, mots: [mot("Réunion", 0.1, 0.5), mot("finie", 0.5, 0.9)], style: "impact", importance: 2, inclinaison: -3, position: "auto" },
  { id: "g2", debutSec: 0.9, finSec: 1.8, mots: [mot("depuis", 0.9, 1.2), { ...mot("trois", 1.2, 1.5), enValeur: true }, { ...mot("jours,", 1.5, 1.8), enValeur: true }], style: "base", importance: 3 },
  { id: "g3", debutSec: 1.8, finSec: 2.9, mots: [mot("personne", 1.8, 2.2), mot("ne", 2.2, 2.4), mot("sait", 2.4, 2.9)], style: "base", souligne: 2 },
  { id: "g4", debutSec: 2.9, finSec: 4.1, mots: [mot("qui", 2.9, 3.2), mot("fait", 3.2, 3.5), { ...mot("quoi.", 3.5, 4.1), enValeur: true }], style: "bandeau", importance: 2, position: "auto" },
  { id: "g5", debutSec: 4.1, finSec: 5, mots: [mot("en", 4.1, 4.3), { ...mot("dix", 4.3, 4.6), enValeur: true }, mot("minutes.", 4.6, 5)] },
];

export function commandeAvocat(formatId: "avocat" | "facecam"): CommandeFabrication {
  const n1 = decorsCatalogue(MAINTENANT).find((d) => d.id === "decor-n1-halo-orange")!;
  return {
    versionContrat: 2,
    moteurId: formatId === "avocat" ? "montage-avocat" : "montage-facecam",
    videoId: "v-temoin",
    formatId,
    versionFormat: 2,
    profilRenduVersion: 1,
    dureeCibleSec: 5,
    ratios: ["9:16", "4:5", "1:1"],
    script: { blocs: [], texteComplet: "" },
    distribution: [{ role: "Face caméra", source: "double", modeAngles: "un-angle", visagesResolus: { "trois-quarts": { visageId: "vis-1" } } }],
    styles: {
      lut: null,
      sousTitres: { id: "st-avocat-v1", nom: "Avocat", valeur: STYLE_SOUS_TITRES_AVOCAT },
      habillage: { id: "hab-avocat-v1", nom: "Avocat", valeur: HABILLAGE_AVOCAT },
      profilSon: { id: "ps-avocat-v1", nom: "Avocat", valeur: PROFIL_SON_AVOCAT },
      musique: null,
      decor: { id: n1.id, nom: n1.nom, valeur: n1.valeur as never },
    },
    briques: { "sous-titres": true, etalonnage: false, illustrations: false, son: true, habillage: false, "texte-ecran": false, "mention-ia": false },
    entrees: {},
    reglages: {},
    plans: [],
    prononciations: [],
    mentionIA: { incrustee: false, position: "haut-droite", dureeSec: 0, texte: "", dansLegende: false },
    budgetMax: { centimes: 0, devise: "EUR" },
    construiteLe: MAINTENANT,
    sousTitres: { base: "karaoke", intensite: "equilibre" },
    medias: {},
  } as CommandeFabrication;
}

export const PLANS = [{ ordre: 1, debutSec: 0, finSec: 5, texte: "t", segmentId: "s1", sourceImage: "double" as const, motsEnValeur: [], cadrage: { pointInteret: { x: 0.5, y: 0.38 }, zoom: 1, valeur: "large" as const }, transition: "coupe" as const, angle: "trois-quarts" as const }];

/** Ce que le moteur dessine pour chaque groupe (entrée, milieu, fin), CSS compris, police nommée comme dans Remotion. */
export function dessinsDe(calque: DonneesCalque) {
  return calque.segments.flatMap((s) =>
    [s.debutSec + 0.001, (s.debutSec + s.finSec) / 2, s.finSec - 0.001].map((t) => {
      const el = elementDe(calque, s, t);
      const css = cssElement(el, calque, `"${el.police}"`);
      return { groupe: s.id, t: +t.toFixed(3), el, css: { conteneur: css.conteneur, ligne: css.ligne, mots: el.mots.map((_, i) => ({ mot: css.mot(i), trait: css.trait(i) })) } };
    }),
  );
}

/** Les calques des autres formats et leurs dessins, en JSON stable. */
export function calquesAutresFormats(): Record<string, unknown> {
  const sortie: Record<string, unknown> = {};
  for (const ratio of ["9:16", "4:5", "1:1"] as const) {
    const avocat = parametresComposition(commandeAvocat("avocat"), { ratio, plans: PLANS as never, segments: SEGMENTS_TEMOIN, dureeSec: 5 }, RECETTE_COMPOSITION_AVOCAT).texte.sousTitres!;
    sortie[`avocat ${ratio}`] = { calque: avocat, dessins: dessinsDe(avocat) };
    const facecam = parametresComposition(commandeAvocat("facecam"), { ratio, plans: PLANS as never, segments: SEGMENTS_TEMOIN, dureeSec: 5, positionSousTitresPct: 64, ...(ratio === "9:16" ? {} : { echelleSousTitres: 0.9 }) }, RECETTE_COMPOSITION_AVOCAT).texte.sousTitres!;
    sortie[`face caméra ${ratio}`] = { calque: facecam, dessins: dessinsDe(facecam) };
  }
  const iv = donneesCalque({ segments: SEGMENTS_TEMOIN, base: "minimal", ratio: "9:16", style: STYLE_SOUS_TITRES_IV });
  sortie["image → vidéo 9:16"] = { calque: iv, dessins: dessinsDe(iv) };
  return JSON.parse(JSON.stringify(sortie));
}
