import { describe, it, expect } from "vitest";
import * as NE from "@/briques/note-extraits";
import { usagesDe } from "@/briques/note-extraits";
import type { ContexteNote, Moment, ResultatTri, SeuilsNoteInteret } from "@/briques/note-extraits";
import * as triVideo from "@/briques/archive-extraits/tri-video";

const CTX: ContexteNote = { sujet: "relances-impayes" };
const SEUILS: SeuilsNoteInteret = NE.SEUILS_PAR_DEFAUT;
function demo(id: string, debutSec: number, dureeSec = 5): Moment {
  return { id, origine: "ecran-demo", debutSec, finSec: debutSec + dureeSec, montre: "interface", avecVisage: false, texteIncruste: false };
}
const dix = (): Moment[] => Array.from({ length: 10 }, (_, i) => demo(`m${String(i).padStart(2, "0")}`, i * 10));

describe("tri d'une vidéo côté brique de la note (X4-06b)", () => {
  it("trierVideo est exporté par l'index et assignable à la signature attendue", () => {
    const f: (m: Moment[], c: ContexteNote, s: SeuilsNoteInteret) => ResultatTri = NE.trierVideo;
    expect(typeof f).toBe("function");
    expect(f([], CTX, SEUILS).rienARetenir).toBe(true);
  });

  it("plafond : 10 moments → 8 gardés, 2 peut-être, départage par id", () => {
    const r = NE.trierVideo([...dix()].reverse(), CTX);
    expect(r.gardes.map((m) => m.id)).toEqual(dix().slice(0, 8).map((m) => m.id));
    expect(r.peutEtre.map((m) => m.id)).toEqual(["m08", "m09"]);
  });

  it("chevauchement à 80 % : seul le mieux noté reste", () => {
    const b: Moment = { ...demo("b", 1, 5), texteIncruste: true };
    const r = NE.trierVideo([b, demo("a", 0, 5)], CTX);
    expect([...r.gardes, ...r.peutEtre].map((m) => m.id)).toEqual(["a"]);
  });

  it("60 s de tête qui parle sans sujet : rien à retenir", () => {
    const parole: Moment[] = Array.from({ length: 12 }, (_, i) => ({
      id: `p${i}`, origine: "parole", debutSec: i * 5, finSec: i * 5 + 5, montre: "visage", avecVisage: true, texteIncruste: true, texte: "bonjour",
    }));
    const r = NE.trierVideo(parole, { sujet: null });
    expect(r.rienARetenir).toBe(true);
    expect(r.gardes).toEqual([]);
  });

  it("garde: 90 → aucun gardé", () => {
    const r = NE.trierVideo(dix(), CTX, { garde: 90, peutEtre: 40, gardesMax: 8 });
    expect(r.gardes).toHaveLength(0);
  });

  it("stable : deux appels donnent le même résultat", () => {
    expect(NE.trierVideo(dix(), CTX)).toEqual(NE.trierVideo(dix(), CTX));
  });

  it("étiqueteur par défaut : écran pour une interface sans visage", () => {
    const r = NE.trierVideo([demo("a", 0)], CTX);
    expect([...r.gardes, ...r.peutEtre][0].usages).toContain("ecran");
  });

  it("étiqueteur par défaut : jamais « preuve-chiffree »", () => {
    const chiffre: Moment = { ...demo("c", 0), montre: "chiffre" };
    const r = NE.trierVideo([chiffre], CTX);
    const tous = [...r.gardes, ...r.peutEtre];
    expect(tous.length).toBeGreaterThan(0);
    expect(tous[0].usages).not.toContain("preuve-chiffree");
  });

  it("étiqueteur fourni : ses usages, pas ceux du défaut", () => {
    const r = NE.trierVideo([demo("a", 0)], CTX, SEUILS, { etiqueter: () => ["fond"] });
    expect([...r.gardes, ...r.peutEtre][0].usages).toEqual(["fond"]);
  });

  it("équivalence avec le tri de l'archive muni de l'étiqueteur par défaut", () => {
    const m = [...dix(), { ...demo("z", 3, 5), montre: "chiffre" as const }];
    const attendu = triVideo.trierVideo(m, CTX, SEUILS, { etiqueter: (x) => usagesDe(x, { chiffresReels: false }) });
    expect(NE.trierVideo(m, CTX, SEUILS)).toEqual(attendu);
  });

  it("entrées gelées non modifiées", () => {
    const m = Object.freeze(dix().map((x) => Object.freeze(x)));
    const c = Object.freeze({ ...CTX });
    const s = Object.freeze({ ...SEUILS });
    const avant = JSON.stringify([m, c, s]);
    expect(() => NE.trierVideo(m as Moment[], c, s)).not.toThrow();
    expect(JSON.stringify([m, c, s])).toBe(avant);
  });
});
