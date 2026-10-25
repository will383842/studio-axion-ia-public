import { describe, expect, it } from "vitest";
import { ToileSpec } from "../../src/domaine/visuels/continu/schema-toile";
import { premierCommentaire, textePost, textesAlternatifs } from "../../src/visuels/continu/texte/post";
import { interditsDans } from "../../src/visuels/services/production";

const page = (type: string, titre: string, texte: string, alt = "") => ({ type, alt: alt || titre, titre, texte });
const toile = ToileSpec.parse({
  version: "toile/1",
  format: "4:5",
  pages: [
    page("X00", "Par où commencer avec l’IA ?", "Un point de départ simple, pas à pas."),
    page("X01", "On avance par étapes", "Chaque étape se vérifie avant la suivante."),
    page("X03", "Un seul cas pour commencer", "Ce qui revient chaque semaine et vous pèse.", "x".repeat(125)),
    page("X02", "Commencez par là", "Dites-nous ce qui vous freine."),
  ],
  raccords: [],
});
const ctx = { interditsDans };

describe("P7 : texte du post", () => {
  it("Instagram : ≤ 2 200 signes, ≤ 5 mots-dièse, jamais de fourre-tout", () => {
    const t = textePost(toile, "instagram", ctx).texte;
    expect(t.length).toBeLessThanOrEqual(2200);
    const tags = t.match(/#[\p{L}\p{N}_]+/gu) ?? [];
    expect(tags.length).toBeGreaterThan(0);
    expect(tags.length).toBeLessThanOrEqual(5);
    expect(t).not.toMatch(/#(fyp|viral|pourtoi)/i);
  });
  it("Facebook : ≤ 5 000 signes, 0 à 3 mots-dièse", () => {
    const t = textePost(toile, "facebook", ctx).texte;
    expect(t.length).toBeLessThanOrEqual(5000);
    expect((t.match(/#[\p{L}\p{N}_]+/gu) ?? []).length).toBeLessThanOrEqual(3);
  });
  it("1re ligne < 140 signes, issue de la page 1 ; un appel de valeur ; jamais « commentez »", () => {
    for (const r of ["instagram", "facebook"] as const) {
      const t = textePost(toile, r, ctx).texte;
      const premiere = t.split("\n")[0];
      expect(premiere.length).toBeLessThan(140);
      expect(premiere).toContain("Par où commencer");
      expect(t).not.toMatch(/commentez/i);
      expect(t).toMatch(/Enregistrez|message privé/);
      expect(t).toContain("On avance par étapes");
    }
  });
  it("le texte passe par la porte : vert sur l'exemple", () => {
    expect(textePost(toile, "instagram", ctx).interdits).toEqual([]);
  });
  it("rouge avec « Grenoble » : le libellé est dans le texte et la porte (espion) reçoit ce texte", () => {
    const mauvaise = ToileSpec.parse({ ...toile, pages: [{ ...toile.pages[0], titre: "Par où commencer à Grenoble ?" }, ...toile.pages.slice(1)] });
    const espion = { interditsDans: (t: string) => (t.includes("Par où") ? ["espion"] : []) };
    const r = textePost(mauvaise, "instagram", espion);
    expect(r.texte).toContain("Grenoble");
    expect(r.interdits).toContain("espion");
    expect(textePost(mauvaise, "instagram", ctx).interdits.length).toBeGreaterThan(0);
  });
  it("un chiffre dans la 1re ligne ou le texte : « chiffre sans fait » signalé", () => {
    const avecChiffre = ToileSpec.parse({ ...toile, pages: [{ ...toile.pages[0], titre: "3 étapes pour bien démarrer avec l’IA" }, ...toile.pages.slice(1)] });
    expect(textePost(avecChiffre, "instagram", ctx).interdits).toContain("chiffre sans fait");
    expect(textePost(toile, "instagram", ctx).interdits).not.toContain("chiffre sans fait");
  });
  it("une page dont le 1er texte a un chiffre : le 2e texte sort en point clé, sans chiffre", () => {
    const mixte = ToileSpec.parse({
      ...toile,
      pages: [toile.pages[0], { ...toile.pages[1], titre: "3 étapes", texte: "Chaque étape se vérifie avant la suivante." }, ...toile.pages.slice(2)],
    });
    const t = textePost(mixte, "instagram", ctx).texte;
    expect(t).toContain("Chaque étape se vérifie");
    expect(t.replace(/#\S+/g, "")).not.toMatch(/\d/);
  });
  it("les points clés visent le titre, et la dernière page est l'appel de valeur (pas un point clé)", () => {
    const t = textePost(toile, "facebook", ctx).texte;
    expect(t).toContain("On avance par étapes");
    expect(t).not.toContain("Chaque étape se vérifie");
    expect(t).not.toContain("Commencez par là");
    expect(t).not.toContain("Dites-nous");
  });
  it("titre de page 1 de 200 signes : 1re ligne < 140, « … » compris", () => {
    const long = ToileSpec.parse({ ...toile, pages: [{ ...toile.pages[0], titre: `${"mot ".repeat(50)}fin` }, ...toile.pages.slice(1)] });
    const premiere = textePost(long, "instagram", ctx).texte.split("\n")[0];
    expect(premiere.length).toBeLessThan(140);
    expect(premiere.endsWith("…")).toBe(true);
  });
  it("aucun chiffre sans fait validé dans le texte", () => {
    expect(textePost(toile, "instagram", ctx).texte.replace(/#\S+/g, "")).not.toMatch(/\d/);
  });
});

describe("P7 : textes alternatifs et premier commentaire", () => {
  it("un alt par page, ≤ 125", () => {
    const alts = textesAlternatifs(toile);
    expect(alts).toHaveLength(toile.pages.length);
    for (const a of alts) expect(a.length).toBeLessThanOrEqual(125);
  });
  it("alt de 130 caractères sans espace : ≤ 125 « … » compris", () => {
    const a = textesAlternatifs({ pages: [{ alt: "x".repeat(130) }] } as never)[0];
    expect(a.length).toBeLessThanOrEqual(125);
  });
  it("alt avec une espace pile à l'indice 125 : ≤ 125 « … » compris", () => {
    const a = textesAlternatifs({ pages: [{ alt: `${"a".repeat(125)} bbbb` }] } as never)[0];
    expect(a.length).toBeLessThanOrEqual(125);
  });
  it("alt vide : construit « Page N sur M : … »", () => {
    const sans = { ...toile, pages: toile.pages.map((p, i) => (i === 1 ? { ...p, alt: "" } : p)) } as never;
    const a = textesAlternatifs(sans)[1];
    expect(a.startsWith("Page 2 sur 4 : ")).toBe(true);
    expect(a.length).toBeLessThanOrEqual(125);
  });
  it("premier commentaire vide en V1", () => {
    expect(premierCommentaire(toile)).toBe("");
  });
});
