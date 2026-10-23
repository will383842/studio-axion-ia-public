/**
 * Lot L3b · variation FACULTATIVE de la brique commune des sous-titres : sans elle, tout est identique au caractère près
 * (les autres formats et l'image → vidéo n'en voient rien) ; avec elle, le sens du premier Impact, les réglages
 * (bornés) et le surlignage du mot mis en avant.
 */
import { describe, expect, it } from "vitest";
import type { SegmentSousTitres } from "@/domaine/types";
import { cssElement, donneesCalque, elementDe, fabriquerSousTitres, INTENSITES, melanger, PLANCHERS_VARIATION, reglagesVaries, type DemandeSousTitres } from "./index";

const TEXTE =
  "Un cabinet comptable perdait 12 heures par semaine à recopier des factures. Chaque matin, deux personnes ouvraient les e-mails un par un. " +
  "Elles tapaient les montants dans un tableur, puis vérifiaient tout à la main. Les erreurs coûtaient cher : 3 relances par client en moyenne. " +
  "On a branché une lecture automatique des pièces jointes. Les factures arrivent classées, les montants sont remplis, le comptable valide en un clic. " +
  "Résultat : 12 heures récupérées chaque semaine, et plus aucune relance oubliée.";

const DEMANDE: DemandeSousTitres = { texte: TEXTE, dureeSec: 38, emphase: ["12 heures", "relances", "un clic"], base: "minimal", occupe: [{ debutSec: 0, finSec: 38, zone: "haut" }], ratio: "9:16", reseaux: ["tiktok", "instagram"] };
const impacts = (s: SegmentSousTitres[]) => s.flatMap((x, i) => (x.style === "impact" ? [i] : []));

describe("L3b · brique sous-titres : défaut inchangé", () => {
  it("sans variation, variation vide ou absente : segments identiques à l'appel sans paramètre", () => {
    const temoin = fabriquerSousTitres(DEMANDE);
    expect(fabriquerSousTitres({ ...DEMANDE, variation: undefined })).toEqual(temoin);
    expect(fabriquerSousTitres({ ...DEMANDE, variation: {} })).toEqual(temoin);
    expect(fabriquerSousTitres({ ...DEMANDE, variation: { reglages: {} } })).toEqual(temoin);
    expect(fabriquerSousTitres({ ...DEMANDE, variation: { sensPremierImpact: 1 } })).toEqual(temoin);
    expect(impacts(temoin).length).toBeGreaterThan(0);
  });

  it("réglages sans variation : ceux de l'intensité (même objet)", () => {
    expect(reglagesVaries(INTENSITES.equilibre)).toBe(INTENSITES.equilibre);
    expect(reglagesVaries(INTENSITES.equilibre, {})).toBe(INTENSITES.equilibre);
  });

  it("calque sans surlignage : aucune clé ajoutée, trait du soulignement inchangé", () => {
    const segments = fabriquerSousTitres(DEMANDE);
    const d = donneesCalque({ segments, base: "minimal", ratio: "9:16" });
    expect("surlignage" in d).toBe(false);
    const s = segments.find((x) => x.souligne !== null && x.souligne !== undefined)!;
    const el = elementDe(d, s, s.finSec - 0.01);
    expect("surlignage" in el).toBe(false);
    const css = cssElement(el, d, "Inter");
    expect(css.trait(s.souligne!)).toEqual({
      position: "absolute",
      left: 0,
      bottom: `${-0.06 * el.taillePx}px`,
      height: 10,
      width: "100%",
      borderRadius: 5,
      background: d.couleurs.accent,
      WebkitTextStroke: "0",
    });
    expect(css.mot(s.souligne!)).toEqual({ color: el.mots[s.souligne!].couleur, opacity: 1, position: "relative", display: "inline-block" });
  });
});

describe("L3b · brique sous-titres : variation", () => {
  it("sens du premier Impact inversé : mêmes groupes en Impact, inclinaisons opposées, toujours alternées", () => {
    const temoin = fabriquerSousTitres(DEMANDE);
    const inverse = fabriquerSousTitres({ ...DEMANDE, variation: { sensPremierImpact: -1 } });
    expect(impacts(inverse)).toEqual(impacts(temoin));
    expect(inverse[impacts(inverse)[0]].inclinaison).toBe(-4);
    for (const i of impacts(temoin)) expect(inverse[i].inclinaison).toBe(-(temoin[i].inclinaison ?? 0));
    expect(inverse.map((s) => ({ ...s, inclinaison: 0 }))).toEqual(temoin.map((s) => ({ ...s, inclinaison: 0 })));
  });

  it("réglages bornés : jamais sous les planchers ; null garde « aucun » ; une clé absente garde l'intensité", () => {
    const r = reglagesVaries(INTENSITES.equilibre, { reglages: { impactEcartSec: 1, bandeauToutesLesSec: 2, souligneUnSur: 1 } });
    expect(r).toEqual({ ...INTENSITES.equilibre, ...PLANCHERS_VARIATION });
    expect(reglagesVaries(INTENSITES.equilibre, { reglages: { bandeauToutesLesSec: null } })).toEqual({ ...INTENSITES.equilibre, bandeauToutesLesSec: null });
    expect(reglagesVaries(INTENSITES.equilibre, { reglages: { souligneUnSur: 7 } })).toEqual({ ...INTENSITES.equilibre, souligneUnSur: 7 });
  });

  it("réglages trop serrés demandés : jamais deux Impact de suite ni à moins de 4 s", () => {
    const s = melanger(fabriquerSousTitres({ ...DEMANDE, intensite: "sobre" }), { intensite: "equilibre", variation: { reglages: { impactEcartSec: 0, souligneUnSur: 0 } } });
    const i = impacts(s);
    expect(i.length).toBeGreaterThan(1);
    for (let k = 1; k < i.length; k++) {
      expect(i[k] - i[k - 1]).toBeGreaterThan(1);
      expect(s[i[k]].debutSec - s[i[k - 1]].debutSec).toBeGreaterThanOrEqual(PLANCHERS_VARIATION.impactEcartSec);
    }
  });

  it("surlignage : fond derrière le mot souligné, texte de sa couleur, sans contour ; couleurs d'écran clair", () => {
    const segments = fabriquerSousTitres(DEMANDE);
    const surlignage = { fond: "#F0703C", texte: "#15100C", fondClair: "#C2532A", texteClair: "#F4EFE7" };
    const d = donneesCalque({ segments, base: "minimal", ratio: "9:16", style: { type: "style-sous-titres", gabarit: "minimal", police: "Inter Bold", tailleRelative: 1, motsParLigne: 6, casse: "normale", animation: "aucune", couleurAccent: "orange", position: "centre", surlignage } });
    expect(d.surlignage).toEqual(surlignage);
    const s = segments.find((x) => x.souligne !== null && x.souligne !== undefined)!;
    const k = s.souligne!;
    const el = elementDe(d, s, s.finSec - 0.01);
    expect(el.surlignage).toEqual({ fond: "#F0703C", texte: "#15100C" });
    expect(el.mots[k].couleur).toBe("#15100C");
    expect(el.mots.filter((_, j) => j !== k).every((m) => m.couleur !== "#15100C")).toBe(true);
    const css = cssElement(el, d, "Inter");
    expect(css.trait(k)).toMatchObject({ position: "absolute", background: "#F0703C", zIndex: -1 });
    expect(css.mot(k)).toMatchObject({ WebkitTextStroke: "0", textShadow: "none" });
    // Avant le mot : ni fond tracé, ni couleur changée.
    const avant = elementDe(d, s, s.debutSec);
    if (s.mots[k].debutSec > s.debutSec) expect(avant.mots[k].couleur).not.toBe("#15100C");
    // Écran clair (ivoire) : orange de la charte, texte ivoire.
    const clair = elementDe({ ...d, passagesClairs: [{ debutSec: 0, finSec: 99, texte: "#15100c" }] }, s, s.finSec - 0.01);
    expect(clair.surlignage).toEqual({ fond: "#C2532A", texte: "#F4EFE7" });
    expect(clair.mots[k].couleur).toBe("#F4EFE7");
  });
});
