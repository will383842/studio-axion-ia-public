import { describe, expect, it } from "vitest";
import { consigneAutreScene, controleScene, ditsAutour, scenesDeSecours, SCENES_DE_SECOURS } from "@/moteurs/montage-facecam-animee/images/litteralite";

describe("ditsAutour", () => {
  const mots = [
    { w: "bonjour", a: 0 },
    { w: "la fuite", a: 9 },
    { w: "robinet", a: 10 },
    { w: "demain", a: 20 },
  ];
  it("renvoie [] sans mots ou liste vide", () => {
    expect(ditsAutour(undefined, 0, 1)).toEqual([]);
    expect(ditsAutour([], 0, 1)).toEqual([]);
  });
  it("garde seulement les mots de la fenêtre élargie et les simplifie", () => {
    expect(ditsAutour(mots, 10, 11)).toEqual(["la", "fuite", "robinet"]);
  });
  it("n'inclut aucun mot si la fenêtre est loin de tous", () => {
    expect(ditsAutour(mots, 100, 101)).toEqual([]);
  });
  it("ne modifie pas l'entrée", () => {
    const copie = JSON.parse(JSON.stringify(mots));
    ditsAutour(mots, 10, 11);
    expect(mots).toEqual(copie);
  });
});

describe("controleScene", () => {
  it("refuse une scène trop vague", () => {
    const r = controleScene("travail", "travail");
    expect(r.length).toBeGreaterThan(0);
    expect(r[0]).toMatch(/^trop vague \(\d+ mot\(s\) porteur\(s\)/);
  });
  it("refuse une scène vide", () => {
    const r = controleScene("", undefined);
    expect(r[0]).toMatch(/^trop vague \(0 mot\(s\)/);
  });
  it("permet une scène littérale qui reprend un mot dit", () => {
    expect(controleScene("gérante qui tape ses devis le soir au bureau", "les devis le soir")).toEqual([]);
  });
  it("signale une scène qui ne reprend aucun mot dit", () => {
    const r = controleScene("homme qui travaille tard le soir", "vos journées n'en finissent plus");
    expect(r.some((d) => d.startsWith("ne reprend aucun mot dit"))).toBe(true);
  });
  it("signale une métaphore non dite, la permet si elle est dite", () => {
    const scene = "gérant qui regarde une horloge au bureau";
    expect(controleScene(scene, undefined).some((d) => d.startsWith("métaphore non dite"))).toBe(true);
    expect(controleScene(scene, undefined, ["horloge"]).some((d) => d.startsWith("métaphore non dite"))).toBe(false);
  });
});

describe("scenesDeSecours", () => {
  it("renvoie [] si illustre est absent ou blanc", () => {
    expect(scenesDeSecours(undefined)).toEqual([]);
    expect(scenesDeSecours("   ")).toEqual([]);
  });
  it("renvoie [] si aucun mot du métier ne correspond", () => {
    expect(scenesDeSecours("zzz qqq")).toEqual([]);
  });
  it("renvoie des scènes de la table pour « devis » et chacune passe le contrôle", () => {
    const r = scenesDeSecours("les devis", []);
    expect(r).toEqual(["gérante qui rédige un devis sur son ordinateur au bureau"]);
    for (const s of r) expect(controleScene(s, "les devis", [])).toEqual([]);
  });
  it("écarte les scènes déjà essayées (casse et espaces ignorés)", () => {
    expect(scenesDeSecours("les devis", [], ["  GÉRANTE QUI RÉDIGE UN DEVIS SUR SON ORDINATEUR AU BUREAU "])).toEqual([]);
  });
  it("ne modifie pas ses entrées et la table est figée", () => {
    const dits = ["devis"];
    const essayees = ["x"];
    scenesDeSecours("les devis", dits, essayees);
    expect(dits).toEqual(["devis"]);
    expect(essayees).toEqual(["x"]);
    expect(Object.isFrozen(SCENES_DE_SECOURS)).toBe(true);
  });
});

describe("consigneAutreScene", () => {
  it("reprend phrase, mots illustrés, scènes essayées et refus", () => {
    const c = consigneAutreScene({ illustre: "les devis", phrase: "Vos devis traînent", essayees: ["a b", "c d"], refus: ["trop sombre"] });
    expect(c).toContain("Phrase dite : « Vos devis traînent ».");
    expect(c).toContain("Mots que la fenêtre illustre : « les devis ».");
    expect(c).toContain("« a b », « c d »");
    expect(c).toContain("- trop sombre");
    expect(c.endsWith("Réponds seulement par la scène, sans guillemets.")).toBe(true);
  });
  it("sans refus : « aucune vidéo trouvée » ; phrase et illustre se remplacent", () => {
    const c = consigneAutreScene({ illustre: "X", essayees: [], refus: [] });
    expect(c).toContain("- aucune vidéo trouvée");
    expect(c).toContain("Phrase dite : « X ».");
    expect(consigneAutreScene({ phrase: "P", essayees: [], refus: [] })).toContain("Mots que la fenêtre illustre : « P ».");
    expect(consigneAutreScene({ essayees: [], refus: [] })).toContain("Phrase dite : «  ».");
  });
  it("ne garde que les 8 derniers refus, tronqués à 220 caractères, sans modifier l'entrée", () => {
    const refus = Array.from({ length: 10 }, (_, i) => `r${i}`);
    refus[9] = "z".repeat(300);
    const copie = [...refus];
    const c = consigneAutreScene({ essayees: [], refus });
    expect(c).not.toContain("- r0\n");
    expect(c).not.toContain("- r1\n");
    expect(c).toContain("- r2\n");
    expect(c).toContain(`- ${"z".repeat(220)}\n`);
    expect(c).not.toContain("z".repeat(221));
    expect(refus).toEqual(copie);
  });
});
