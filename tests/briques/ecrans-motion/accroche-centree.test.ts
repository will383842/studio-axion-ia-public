/**
 * Brique `ecrans-motion` (M8c, point 4) : l'accroche est centrée verticalement dans la place qu'elle a (sous la marque,
 * au-dessus de la bande des sous-titres), comme la vidéo de référence, sans sortir de la zone de texte. Option de gabarit
 * `centrer` : les autres types gardent leur premier écart.
 */
import { describe, expect, it } from "vitest";
import { boiteDans, boites, charteDuoPour, disposer, proprietesEcrans, zonesEcran, type EcranCale, type ZoneProtegeePct } from "../../../src/briques/ecrans-motion";
import { optionsDe } from "../../../src/briques/ecrans-motion/proprietes";
import { zoneProtegeeCombinee } from "../../../src/reseaux";

const QUATRE = zoneProtegeeCombinee("9:16", ["facebook", "instagram", "tiktok", "linkedin"])! as ZoneProtegeePct;
const BANDE = 0.08;

const accroche = (lignes: string[]) =>
  proprietesEcrans({
    ecrans: [{ id: "e01", fond: "sombre", debutMs: 0, finMs: 2000, evenements: [], type: "accroche", etiquette: "Recrutement · cas réel", lignes } as EcranCale],
    captures: {},
    zoneProtegee: QUATRE,
    bandeSousTitres: BANDE,
  })[0];

describe("accroche centrée", () => {
  for (const lignes of [["On recrute", "nos collaborateurs", "*en…*"], ["On recrute", "*vite.*"], ["*Vite.*"]]) {
    it(`${lignes.length} ligne(s) : autant de place au-dessus (sous la marque) qu'au-dessous (avant la bande), dans la zone de texte`, () => {
      const p = accroche(lignes);
      const { textes, boites: b } = disposer(p);
      const contenu = textes.filter((t) => t.nom !== "marque");
      const haut = Math.min(...contenu.map((t) => t.boite.y));
      const bas = Math.max(...contenu.map((t) => t.boite.y + t.boite.hauteur));
      const dessus = haut - (b.marque.boite.y + b.marque.boite.hauteur);
      const dessous = p.zone.y + p.zone.hauteur - bas;
      expect(dessus).toBeGreaterThan(0);
      expect(Math.abs(dessus - dessous)).toBeLessThanOrEqual(2);
      const texte = zonesEcran(QUATRE, 1080, 1920, BANDE).texte;
      for (const t of contenu) expect(boiteDans(t.boite, texte), t.nom).toBe(true);
    });
  }

  it("l'option `centrer` est portée par l'accroche seule ; sans elle, la pose reste celle d'avant (premier écart du gabarit)", () => {
    expect(optionsDe({ type: "accroche", lignes: ["a", "b"] })).toEqual({ lignes: 2, centrer: true });
    expect(optionsDe({ type: "titre", lignes: ["a", "b"] })).toEqual({ lignes: 2 });
    const zone = zonesEcran(QUATRE, 1080, 1920, BANDE).utile;
    const sans = boites("accroche", zone, charteDuoPour(1920), { lignes: 3 });
    const marque = sans.marque.boite;
    expect(sans.textes[0].boite.y).toBe(Math.round((marque.y + marque.hauteur) * 100) / 100);
    const avec = boites("accroche", zone, charteDuoPour(1920), { lignes: 3, centrer: true });
    expect(avec.textes[0].boite.y).toBeGreaterThan(sans.textes[0].boite.y);
    expect(avec.textes.map((t) => t.boite.hauteur)).toEqual(sans.textes.map((t) => t.boite.hauteur));
  });
});
