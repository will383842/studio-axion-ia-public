/**
 * GV-ST-03 · Image → vidéo : le style de sous-titres choisi dans la Bibliothèque fait loi ; sans choix, charte duo sans
 * tirage par version. Ne dépend pas de `studio-rendu` (passe avec ou sans ses dépendances).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { baseRetenue } from "@/briques/sous-titres";
import { MISE_EN_PAGE_IV } from "@/briques/schema-motion/types";
import type { RecetteVarieteIV } from "@/briques/schema-motion/variete";
import type { CarteImage } from "@/domaine/image-video/carte";
import { RESEAUX_IV } from "@/domaine/image-video/plafonds";
import type { ValeurStyleSousTitres } from "@/domaine/types";
import { idElementBruitage, SONS_BANQUE } from "@/donnees/bruitages";
import type { BruitageValideIV } from "@/moteurs/montage-image-video/bruitages";
import { pisteSimulee } from "@/moteurs/montage-image-video/calage";
import { FICHES_SIMULEES } from "@/moteurs/montage-image-video/ecriture.simulation";
import { mettreEnSceneIV } from "@/moteurs/montage-image-video/mise-en-scene";
import { codeSousTitresIV, sousTitresVariesIV, STYLE_SOUS_TITRES_IV, styleRetenuIV, VARIANTE_PAR_VERSION, type StyleChoisiIV } from "@/moteurs/montage-image-video/sous-titres-varies";
import { RECETTE_REFERENCE_IV } from "@/moteurs/montage-image-video/variete/tirage";
import { CENTRE_SOUS_TITRES_IV_4X5_PCT, commandeDuMontageIV } from "@/services/image-video-rendu";
import { planDesFinsAvant as planDesFinsIV } from "./plan-des-fins-avant";

const VALIDES: BruitageValideIV[] = SONS_BANQUE.map((s) => ({ elementId: idElementBruitage(s), declencheur: s.declencheur, variante: s.variante, dureeSec: s.dureeSec }));
const carte: CarteImage = JSON.parse(readFileSync(join(process.cwd(), "tests/image-video/fixtures/cartes/C.json"), "utf8"));

function ligneDe(sousTitres?: RecetteVarieteIV["sousTitres"], format?: "4:5") {
  const fiche = FICHES_SIMULEES["essai-c"];
  const fin = planDesFinsIV({ reseaux: RESEAUX_IV, offre: carte.offre, questionCommentaire: fiche.questionCommentaire.texteDit }).fins.find((f) => f.reseaux.includes("youtube-shorts"))!;
  return mettreEnSceneIV({ carte, fiche, voix: pisteSimulee(fiche, fin.muet ? null : fin), fin, reseaux: fin.reseaux, bruitagesValides: VALIDES, ...(format ? { format } : {}), ...(sousTitres ? { variete: { ...RECETTE_REFERENCE_IV, sousTitres } } : {}) }).ligne;
}

const KARAOKE: StyleChoisiIV = {
  id: "sous-titres-karaoke",
  nom: "Karaoké",
  valeur: { ...(STYLE_SOUS_TITRES_IV as unknown as ValeurStyleSousTitres), gabarit: "karaoke", police: "Police du style Karaoké", positionPct: 50 },
};

describe("GV-ST-03 · style retenu", () => {
  it("sans style choisi : la charte duo, 9:16 inchangé, 4:5 centré dans sa bande", () => {
    expect(styleRetenuIV(undefined, "9:16")).toEqual({ valeur: STYLE_SOUS_TITRES_IV, deplace: false, choisi: false });
    expect(styleRetenuIV(null, "4:5").valeur.positionPct).toBe(CENTRE_SOUS_TITRES_IV_4X5_PCT);
    expect(styleRetenuIV({ id: "x", nom: "sans valeur" }, "9:16").choisi).toBe(false);
  });

  it("Karaoké choisi : base karaoké et police du style", () => {
    const r = styleRetenuIV(KARAOKE, "9:16");
    expect(r.choisi).toBe(true);
    expect(r.valeur.police).toBe("Police du style Karaoké");
    expect(baseRetenue(undefined, r.valeur)).toBe("karaoke");
  });

  it("position hors bande : ramenée dans la bande ; dans la bande : gardée", () => {
    const b = MISE_EN_PAGE_IV["4:5"].bandeSousTitres;
    const bas = styleRetenuIV({ ...KARAOKE, valeur: { ...KARAOKE.valeur!, positionPct: 95 } }, "4:5");
    expect(bas.deplace).toBe(true);
    expect(bas.valeur.positionPct).toBeCloseTo(b.bas * 100, 1);
    const haut = styleRetenuIV({ ...KARAOKE, valeur: { ...KARAOKE.valeur!, positionPct: 5 } }, "4:5");
    expect(haut.deplace).toBe(true);
    expect(haut.valeur.positionPct).toBeCloseTo(b.haut * 100, 1);
    const dedans = styleRetenuIV({ ...KARAOKE, valeur: { ...KARAOKE.valeur!, positionPct: ((b.haut + b.bas) / 2) * 100 } }, "4:5");
    expect(dedans.deplace).toBe(false);
  });
});

describe("GV-ST-03 · commande du montage", () => {
  const piste = { mots: [{ mot: "bonjour", debutSec: 0, finSec: 1 }] } as never;
  const mixage = { bruitages: [] } as never;
  it("sans style : « Charte duo » comme avant", () => {
    const ligne = ligneDe();
    const c = commandeDuMontageIV({ videoId: "v", ligne, mixage, piste }, [], []);
    expect(c.styles.sousTitres?.id).toBe("sous-titres-duo");
    expect(c.styles.sousTitres?.valeur).toEqual(STYLE_SOUS_TITRES_IV);
  });
  it("Karaoké choisi : la commande porte le style choisi, position ramenée dans la bande si besoin", () => {
    const ligne = ligneDe();
    const c = commandeDuMontageIV({ videoId: "v", ligne, mixage, piste, styleSousTitres: KARAOKE }, [], []);
    expect(c.styles.sousTitres?.id).toBe("sous-titres-karaoke");
    expect((c.styles.sousTitres?.valeur as ValeurStyleSousTitres).gabarit).toBe("karaoke");
    const hors = commandeDuMontageIV({ videoId: "v", ligne, mixage, piste, styleSousTitres: { ...KARAOKE, valeur: { ...KARAOKE.valeur!, positionPct: 99 } } }, [], []);
    expect((hors.styles.sousTitres?.valeur as ValeurStyleSousTitres).positionPct).toBeLessThan(99);
  });
});

describe("GV-ST-03 · plus de tirage par version", () => {
  it("tirage éteint par défaut", () => {
    expect(VARIANTE_PAR_VERSION).toBe(false);
  });
  it("deux versions (recettes SOU-B, SOU-C, SOU-D, SOU-E) : mêmes sous-titres", () => {
    const ref = JSON.stringify(sousTitresVariesIV(ligneDe("SOU-B")));
    for (const code of ["SOU-C", "SOU-D", "SOU-E"] as const) {
      const l = ligneDe(code);
      expect(codeSousTitresIV(l)).toBeUndefined();
      const sortie = sousTitresVariesIV(l).map((s) => ({ debutSec: s.debutSec, finSec: s.finSec, mots: s.mots.map((m) => m.mot) }));
      const attendu = sousTitresVariesIV(ligneDe("SOU-B")).map((s) => ({ debutSec: s.debutSec, finSec: s.finSec, mots: s.mots.map((m) => m.mot) }));
      expect(sortie, code).toEqual(attendu);
    }
    expect(ref.length).toBeGreaterThan(2);
  });
});
