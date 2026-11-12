/**
 * GV-ST-02 · cas concret : la variante de sous-titres tirée par vidéo est supprimée par défaut ; le style choisi dans la
 * Bibliothèque fait loi (base karaoké pour un style karaoké). Calcul pur : aucun appel réel.
 */
import { describe, expect, it } from "vitest";
import { baseRetenue } from "@/briques/sous-titres";
import { STYLE_SOUS_TITRES_AVOCAT } from "@/donnees/elements-avocat";
import {
  centreSousTitresCasConcret,
  surlignageCasConcret,
  variationSousTitresCasConcret,
  VARIANTE_PAR_VIDEO,
  type TirageSousTitres,
} from "@/moteurs/montage-cas-concret/sous-titres-variete";
import { fabriquerCasConcret } from "@/moteurs/montage-cas-concret/fabriquer";
import { TIRAGE_V4 } from "@/moteurs/montage-cas-concret/variete";
import { centreSousTitresPleineImagePct } from "@/moteurs/montage-cas-concret/zone-objets";
import { doubles } from "./fabriquer/doubles";

const V4: TirageSousTitres = TIRAGE_V4.sousTitres;
const VIDEO_A: TirageSousTitres = { inclinaison: "inverse", intensite: "vif", accent: "surlignage", hauteur: "haute" };
const VIDEO_B: TirageSousTitres = { inclinaison: "v4", intensite: "calme", accent: "v4", hauteur: "v4" };

describe("GV-ST-02 · plus de variante tirée par vidéo", () => {
  it("la variante par vidéo est coupée par défaut", () => {
    expect(VARIANTE_PAR_VIDEO).toBe(false);
  });

  it("deux vidéos de tirages différents : aucun écart d'inclinaison, de surlignage ni de hauteur", () => {
    for (const t of [undefined, null, V4, VIDEO_A, VIDEO_B]) {
      expect(variationSousTitresCasConcret(t)).toEqual({});
      expect(surlignageCasConcret(t)).toEqual({});
      expect(centreSousTitresCasConcret(t)).toBe(centreSousTitresPleineImagePct());
    }
  });
});

describe("GV-ST-02 · style de la Bibliothèque", () => {
  it("un style karaoké donne la base karaoké ; la base de la commande l'emporte", () => {
    expect(baseRetenue(undefined, STYLE_SOUS_TITRES_AVOCAT)).toBe("karaoke");
    expect(baseRetenue("minimal", STYLE_SOUS_TITRES_AVOCAT)).toBe("minimal");
  });
});

describe("GV-ST-02 · chaîne : empreinte et position avec un style choisi", () => {
  const karaoke = { id: "st-karaoke", nom: "Karaoké", valeur: STYLE_SOUS_TITRES_AVOCAT };
  type Calque = { texte: { sousTitres: { positions: { milieuPct: number } } } };
  const fabriquer = async (style?: typeof karaoke) => {
    const d = doubles();
    if (style) d.options.styleSousTitres = style;
    await fabriquerCasConcret(d.options);
    const soumises = d.compositionsSoumises();
    return { ids: soumises.map((c) => c.idRendu), milieux: soumises.map((c) => (c.parametres as Calque).texte.sousTitres.positions.milieuPct) };
  };

  it("avec un style choisi : empreinte différente de « Charte duo », stable d'un passage à l'autre, position du style", async () => {
    const sans = await fabriquer();
    const avec = await fabriquer(karaoke);
    const encore = await fabriquer(karaoke);
    expect(avec.ids.length).toBeGreaterThan(0);
    avec.ids.forEach((id, i) => expect(id).not.toBe(sans.ids[i]));
    expect(encore.ids).toEqual(avec.ids);
    for (const m of avec.milieux) expect(m).toBe(STYLE_SOUS_TITRES_AVOCAT.positionPct);
    for (const m of sans.milieux) expect(m).toBe(centreSousTitresPleineImagePct());
  });

  it("sans style choisi (absent ou null) : empreinte identique à la fabrication d'avant", async () => {
    const temoin = await fabriquer();
    const d = doubles();
    d.options.styleSousTitres = null;
    await fabriquerCasConcret(d.options);
    expect(d.compositionsSoumises().map((c) => c.idRendu)).toEqual(temoin.ids);
  });
});
