/**
 * C2-U5bis · cas concret : chaîne complète (`fabriquerCasConcret`) avec `styleVarie` : le style « sous-titres-duo » rendu
 * porte le marqueur terracotta pour un tirage « surlignage » ; un style choisi dans la Bibliothèque fait toujours loi.
 */
import { describe, expect, it } from "vitest";
import { STYLE_SOUS_TITRES_AVOCAT } from "@/donnees/elements-avocat";
import { MARQUEURS } from "@/briques/sous-titres/marqueur";
import { fabriquerCasConcret } from "@/moteurs/montage-cas-concret/fabriquer";
import { TIRAGE_V4 } from "@/moteurs/montage-cas-concret/variete";
import { doubles } from "../fabriquer/doubles";

const surligne = { ...TIRAGE_V4, sousTitres: { ...TIRAGE_V4.sousTitres, accent: "surlignage" as const } };
const miseSurlignee = { version: "variete/1", tirage: surligne, ecrans: {} };
const karaoke = { id: "st-karaoke", nom: "Karaoké", valeur: STYLE_SOUS_TITRES_AVOCAT };

type Calque = { texte: { sousTitres: { positions: { milieuPct: number } } } };
async function fabriquer(o: { styleVarie?: boolean; style?: typeof karaoke } = {}) {
  const d = doubles({ retoucherFiche: (f) => ({ ...f, mise: miseSurlignee }) });
  if (o.styleVarie !== undefined) d.options.styleVarie = o.styleVarie;
  if (o.style) d.options.styleSousTitres = o.style;
  await fabriquerCasConcret(d.options);
  const soumises = d.compositionsSoumises();
  return { ids: soumises.map((c) => c.idRendu), json: soumises.map((c) => JSON.stringify(c.parametres)), milieux: soumises.map((c) => (c.parametres as Calque).texte.sousTitres.positions.milieuPct) };
}

describe("C2-U5bis · chaîne : tirage surligné + styleVarie", () => {
  it("styleVarie=true : le style « sous-titres-duo » rendu porte MARQUEURS.terracotta, et l'empreinte change", async () => {
    const sans = await fabriquer();
    const avec = await fabriquer({ styleVarie: true });
    expect(avec.ids.length).toBeGreaterThan(0);
    for (const j of avec.json) {
      expect(j).toContain(MARQUEURS.terracotta.fond);
      expect(j).toContain(JSON.stringify(MARQUEURS.terracotta));
    }
    for (const j of sans.json) expect(j).not.toContain(JSON.stringify(MARQUEURS.terracotta));
    avec.ids.forEach((id, i) => expect(id).not.toBe(sans.ids[i]));
  });

  it("styleVarie=false : identique à l'absence d'option", async () => {
    const sans = await fabriquer();
    const faux = await fabriquer({ styleVarie: false });
    expect(faux.ids).toEqual(sans.ids);
    expect(faux.json).toEqual(sans.json);
  });
});

describe("C2-U5bis · chaîne : un style choisi dans la Bibliothèque fait loi", () => {
  it("styleSousTitres choisi + styleVarie=true : mêmes style, base, position et empreinte que sans styleVarie", async () => {
    const sans = await fabriquer({ style: karaoke });
    const avec = await fabriquer({ style: karaoke, styleVarie: true });
    expect(avec.ids.length).toBeGreaterThan(0);
    expect(avec.ids).toEqual(sans.ids);
    expect(avec.json).toEqual(sans.json);
    expect(avec.milieux).toEqual(sans.milieux);
    for (const m of avec.milieux) expect(m).toBe(STYLE_SOUS_TITRES_AVOCAT.positionPct);
    for (const j of avec.json) expect(j).not.toContain(JSON.stringify(MARQUEURS.terracotta));
  });
});
