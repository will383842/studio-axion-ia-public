/** RangeePastilles : un texte de plus de 2 caractères ne doit jamais déborder de sa pastille (vidéo v-e5d262bd9da5 : « FORME », « ÉQUIPES » se chevauchaient). */
import { describe, expect, it } from "vitest";

const charger = async () => {
  const lot = await import("../../studio-rendu/compositions/interface-claire/motion-v4/lot1/RangeePastilles");
  const commun = await import("../../studio-rendu/compositions/interface-claire/motion-v4/lot1/commun-lot1");
  return { mesurerPastilles: lot.mesurerPastilles, largeurTexte: commun.largeurTexte, TRAIT: commun.TRAIT, W: commun.W };
};

describe("RangeePastilles · mesure", () => {
  it("[Forme, Équipes, IA] : chaque pastille contient son texte et la rangée tient dans 0,86 L", async () => {
    const { mesurerPastilles, largeurTexte, TRAIT, W } = await charger();
    const items = ["Forme", "Équipes", "IA"];
    const m = mesurerPastilles(items, { ecart: 14 });
    items.forEach((t, k) => {
      if (t.length > 2) expect(m.largeurs[k]).toBeGreaterThanOrEqual(largeurTexte(t.toUpperCase(), m.corps) + 2 * TRAIT.MOYEN);
    });
    expect(m.largeurs[2]).toBe(100);
    expect(m.largeurRangee).toBeLessThanOrEqual(0.86 * W);
    expect(m.largeurRangee).toBe(m.largeurs.reduce((s, l) => s + l, 0) + 2 * 14);
  });
  it("les chiffres ne changent pas : 100 px, corps 58", async () => {
    const { mesurerPastilles } = await charger();
    const m = mesurerPastilles(["1", "2", "3"], { ecart: 14 });
    expect(m.largeurs).toEqual([100, 100, 100]);
    expect(m.corps).toBe(58);
  });
  it("5 mots de 5 lettres : le corps diminue (≥ 34) et la rangée tient", async () => {
    const { mesurerPastilles, W } = await charger();
    const m = mesurerPastilles(Array.from({ length: 5 }, () => "ABCDE"), { ecart: 14 });
    expect(m.corps).toBeGreaterThanOrEqual(34);
    expect(m.corps).toBeLessThan(58);
    expect(m.largeurRangee).toBeLessThanOrEqual(0.86 * W);
  });
  it("5 mots de 10 lettres : le corps passe sous 34 en dernier recours", async () => {
    const { mesurerPastilles } = await charger();
    expect(mesurerPastilles(Array.from({ length: 5 }, () => "ABCDEFGHIJ"), { ecart: 14 }).corps).toBeLessThan(34);
  });
  it("3 mots de 14 lettres larges (« M ») : la rangée ne dépasse jamais l'écran moins 2 × 40 px", async () => {
    const { mesurerPastilles, W } = await charger();
    const m = mesurerPastilles(Array.from({ length: 3 }, () => "MMMMMMMMMMMMMM"), { ecart: 14 });
    expect(m.largeurRangee).toBeLessThanOrEqual(W - 80);
    expect(m.corps).toBeLessThan(34);
    const m2 = mesurerPastilles(Array.from({ length: 5 }, () => "MMMMM"), { ecart: 14 });
    expect(m2.largeurRangee).toBeLessThanOrEqual(W - 80);
  });
});
