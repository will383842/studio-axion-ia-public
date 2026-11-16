/** Extraits maison v4 (C4-U4.2) : choisir un extrait par les mots du thème. Pur, sans réseau. */
import { describe, expect, it } from "vitest";
import { choisirExtraitV4, type CandidatChoixV4 } from "@/moteurs/montage-facecam-animee/extraits-maison/choisir";
import { lireRechercheAxion } from "@/moteurs/montage-facecam-animee/extraits-maison/recherche";
import { cleUsageExtrait } from "@/briques/bibliotheque-video/types";

const cand = (id: string, o: Partial<CandidatChoixV4> = {}): CandidatChoixV4 => ({
  id, capacite: "extrait" as never, cle: id, elementId: `el-${id}`, plageId: `pl-${id}`,
  debutSec: 10, finSec: 20, ratio: "16:9" as never, visage: "aucun", texteIncruste: false, famille: [],
  licenceOk: true, parentes: [], texte: "", motsCles: [], ...o,
});
const base = { dureeFenetreSec: 3, videoId: "v1", dejaPris: [] as string[], recents: [] as string[] };
const cle = (c: CandidatChoixV4) => cleUsageExtrait(c.elementId, c.plageId);

/* Table d'exemples : thème → extrait */
describe("choisirExtraitV4 · table d'exemples", () => {
  const A = cand("a", { texte: "un chat dort sur le bureau" });
  const B = cand("b", { motsCles: ["voiture"], texte: "route" });
  const C = cand("c", { texte: "plage en été" });
  const cas: [string[], string | null][] = [
    [["chat"], "a"], [["voiture"], "b"], [["ete"], "c"], [["Été"], "c"], [["montagne"], null], [[], null],
  ];
  it.each(cas)("thème %j → %s", (motsCles, id) => {
    const r = choisirExtraitV4({ ...base, recherche: { motsCles }, candidats: [A, B, C] });
    expect(r?.extrait.id ?? null).toBe(id);
  });
});

describe("choisirExtraitV4 · règles", () => {
  it("un mot dans motsCles (×2) bat un mot dans texte (×1)", () => {
    const t = cand("t", { texte: "chat" }), m = cand("m", { motsCles: ["chat"] });
    expect(choisirExtraitV4({ ...base, recherche: { motsCles: ["chat"] }, candidats: [t, m] })?.extrait.id).toBe("m");
  });
  it("plage de 2 s refusée", () => {
    const c = cand("c", { texte: "chat", debutSec: 0, finSec: 2 });
    expect(choisirExtraitV4({ ...base, recherche: { motsCles: ["chat"] }, candidats: [c] })).toBeNull();
  });
  it("plage de 3,2 s, fenêtre 3,5 s : la longueur est bornée par la plage", () => {
    const c = cand("c", { texte: "chat", debutSec: 0, finSec: 3.2 });
    const r = choisirExtraitV4({ ...base, dureeFenetreSec: 3.5, recherche: { motsCles: ["chat"] }, candidats: [c] })!;
    expect(r.debutSec + r.longueurSec).toBeLessThanOrEqual(3.2 + 1e-9);
  });
  it("clé dans dejaPris refusée", () => {
    const c = cand("c", { texte: "chat" });
    expect(choisirExtraitV4({ ...base, dejaPris: [cle(c)], recherche: { motsCles: ["chat"] }, candidats: [c] })).toBeNull();
  });
  it("clé dans recents refusée", () => {
    const c = cand("c", { texte: "chat" });
    expect(choisirExtraitV4({ ...base, recents: [cle(c)], recherche: { motsCles: ["chat"] }, candidats: [c] })).toBeNull();
  });
  it("deux appels identiques → même résultat ; égalité stable quel que soit l'ordre", () => {
    const l = ["a", "b", "c", "d"].map((i) => cand(i, { texte: "chat" }));
    const a = choisirExtraitV4({ ...base, recherche: { motsCles: ["chat"] }, candidats: l });
    const b = choisirExtraitV4({ ...base, recherche: { motsCles: ["chat"] }, candidats: l });
    const c = choisirExtraitV4({ ...base, recherche: { motsCles: ["chat"] }, candidats: [...l].reverse() });
    expect(b).toEqual(a);
    expect(c?.extrait.id).toBe(a?.extrait.id);
  });
  it("l'extrait rendu tient dans sa plage", () => {
    const c = cand("c", { texte: "chat", debutSec: 5, finSec: 9 });
    const r = choisirExtraitV4({ ...base, recherche: { motsCles: ["chat"] }, candidats: [c] })!;
    expect(r.debutSec).toBeGreaterThanOrEqual(5);
    expect(r.debutSec + r.longueurSec).toBeLessThanOrEqual(9 + 1e-9);
    expect(r.longueurSec).toBeGreaterThanOrEqual(3);
  });
  it("mots vides désaccentués (« à » → « a ») ne comptent pas : seuil d'un mot plein", () => {
    const recherche = lireRechercheAxion("axion: voyage à Lisbonne")!;
    const c = cand("c", { texte: "il a fait beau" });
    expect(choisirExtraitV4({ ...base, recherche, candidats: [c] })).toBeNull();
    const ok = cand("o", { texte: "voyage en train" });
    expect(choisirExtraitV4({ ...base, recherche, candidats: [c, ok] })?.extrait.id).toBe("o");
  });
});
