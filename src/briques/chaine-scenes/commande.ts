/**
 * Commande de fabrication MINIMALE d'une chaîne par scènes (lue par `parametresComposition`, sans base) : les scènes
 * rendues comme médias `scene:<id>`, le décor et le style de sous-titres donnés par l'appelant, aucune LUT, aucune
 * musique, aucun bruitage.
 */
import type { CommandeFabrication, MediaCommande, StyleResolu, ValeurDecor, ValeurStyleSousTitres } from "@/domaine/types";
import type { ScenePosee } from "./plans";

export interface EntreeCommandeMinimale {
  moteurId: string;
  formatId: string;
  versionFormat: number;
  videoId: string;
  texteScript: string;
  dureeSec: number;
  scenes: readonly ScenePosee[];
  /** Style complet, position comprise. */
  styleSousTitres: StyleResolu<ValeurStyleSousTitres>;
  decor: StyleResolu<ValeurDecor>;
  /** Personnage qui prête sa voix (inscrit dans la distribution). */
  personnageId?: string;
  prononciations?: readonly { mot: string; prononciation: string }[];
}

export function commandeMinimale(o: EntreeCommandeMinimale): CommandeFabrication {
  const medias: Record<string, MediaCommande> = Object.fromEntries(o.scenes.map((s) => [`scene:${s.id}`, { cle: s.cle, mime: "video/mp4", dureeSec: +(s.finSec - s.debutSec).toFixed(3) }]));
  return {
    versionContrat: 2,
    moteurId: o.moteurId,
    videoId: o.videoId,
    formatId: o.formatId,
    versionFormat: o.versionFormat,
    profilRenduVersion: 1,
    dureeCibleSec: Math.round(o.dureeSec),
    ratios: ["9:16"],
    script: { blocs: [], texteComplet: o.texteScript },
    distribution: [{ role: "voix", source: "double", ...(o.personnageId ? { personnageId: o.personnageId } : {}) }],
    styles: { sousTitres: o.styleSousTitres, decor: o.decor, lut: null, musique: null },
    briques: { "sous-titres": true, etalonnage: false, illustrations: true, son: true, habillage: false, "texte-ecran": false, "mention-ia": false },
    entrees: {},
    reglages: {},
    plans: [],
    prononciations: [...(o.prononciations ?? [])],
    mentionIA: { incrustee: false, position: "haut-droite", dureeSec: 0, texte: "", dansLegende: false },
    budgetMax: { centimes: 0, devise: "EUR" },
    construiteLe: "1970-01-01T00:00:00.000Z",
    sousTitres: { base: "minimal", intensite: "equilibre" },
    medias,
  };
}
