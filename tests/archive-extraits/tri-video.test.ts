import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import type { ContexteNote, Moment, ResultatTri, SeuilsNoteInteret } from "@/briques/note-extraits";
import {
  trierVideo, PEUT_ETRE_MAX, SEUIL_CHEVAUCHEMENT, RAISON_CHEVAUCHEMENT, RAISON_PLAFOND, RAISON_PEU_D_INTERET,
} from "@/briques/archive-extraits/tri-video";

const CTX: ContexteNote = { sujet: "relances-impayes" };
function demo(id: string, debutSec: number, dureeSec = 5): Moment {
  return { id, origine: "ecran-demo", debutSec, finSec: debutSec + dureeSec, montre: "interface", avecVisage: false, texteIncruste: false };
}
const dix = (): Moment[] => Array.from({ length: 10 }, (_, i) => demo(`m${String(i).padStart(2, "0")}`, i * 10));

describe("tri d'une vidéo", () => {
  it("constantes", () => {
    expect(PEUT_ETRE_MAX).toBe(12);
    expect(SEUIL_CHEVAUCHEMENT).toBe(0.5);
    expect([RAISON_CHEVAUCHEMENT, RAISON_PLAFOND, RAISON_PEU_D_INTERET]).toEqual(["chevauchement", "plafond", "peu-d-interet"]);
  });

  it("plafond : 10 moments à 80 → 8 gardés, 2 peut-être, départage par id", () => {
    const r = trierVideo([...dix()].reverse(), CTX);
    expect(r.gardes.map((m) => m.id)).toEqual(dix().slice(0, 8).map((m) => m.id));
    expect(r.peutEtre.map((m) => m.id)).toEqual(["m08", "m09"]);
    expect(r.gardes[0].note).toBe(80);
    expect(r.gardes[0].decision).toBe("garde");
    expect(r.peutEtre[0].decision).toBe("peut-etre");
    expect(r.ignores).toEqual({ nombre: 0, raisonPrincipale: null });
    expect(r.rienARetenir).toBe(false);
  });

  it("chevauchement : 80 % communs → seul le mieux noté reste", () => {
    const a = demo("a", 0, 5);
    const b: Moment = { ...demo("b", 1, 5), texteIncruste: true };
    const r = trierVideo([b, a], CTX);
    expect([...r.gardes, ...r.peutEtre].map((m) => m.id)).toEqual(["a"]);
    expect(r.ignores).toEqual({ nombre: 1, raisonPrincipale: "chevauchement" });
  });

  it("tête qui parle de 60 s → rien à retenir", () => {
    const parole: Moment[] = Array.from({ length: 12 }, (_, i) => ({
      id: `p${i}`, origine: "parole", debutSec: i * 5, finSec: i * 5 + 5, montre: "visage", avecVisage: true, texteIncruste: true, texte: "bonjour",
    }));
    const r = trierVideo(parole, { sujet: null });
    expect(r.rienARetenir).toBe(true);
    expect(r.gardes).toEqual([]);
    expect(r.ignores.nombre).toBe(12);
    expect(r.ignores.raisonPrincipale).not.toBeNull();
  });

  it("seuils reçus respectés", () => {
    const s: SeuilsNoteInteret = { garde: 90, peutEtre: 40, gardesMax: 8 };
    const r = trierVideo(dix(), CTX, s);
    expect(r.gardes).toHaveLength(0);
    expect(r.peutEtre).toHaveLength(10);
    expect(r.rienARetenir).toBe(true);
    const r2 = trierVideo(dix(), CTX, { garde: 60, peutEtre: 40, gardesMax: 2 });
    expect(r2.gardes).toHaveLength(2);
    expect(r2.peutEtre).toHaveLength(8);
  });

  it("moment exclu jamais gardé ni peut-être", () => {
    const r = trierVideo(dix().slice(0, 3), (m) => ({ ...CTX, etat: m.id === "m01" ? "exclue" : undefined }), { garde: 0, peutEtre: 0, gardesMax: 8 });
    expect([...r.gardes, ...r.peutEtre].map((m) => m.id)).not.toContain("m01");
    expect(r.ignores).toEqual({ nombre: 1, raisonPrincipale: "exclu-droit" });
  });

  it("etiqueter fourni → ses usages ; absent → []", () => {
    expect(trierVideo(dix().slice(0, 2), CTX, undefined, { etiqueter: () => ["ecran"] }).gardes[0].usages).toEqual(["ecran"]);
    expect(trierVideo(dix().slice(0, 2), CTX).gardes[0].usages).toEqual([]);
  });

  it("plus de 12 peut-être → 12, reste en plafond", () => {
    const quinze = Array.from({ length: 15 }, (_, i) => demo(`q${String(i).padStart(2, "0")}`, i * 10));
    const r = trierVideo(quinze, CTX, { garde: 90, peutEtre: 40, gardesMax: 8 });
    expect(r.peutEtre).toHaveLength(12);
    expect(r.ignores).toEqual({ nombre: 3, raisonPrincipale: "plafond" });
  });

  it("peu d'intérêt : note sous le seuil sans malus", () => {
    const m: Moment = { id: "x", origine: "scene", debutSec: 0, finSec: 10, montre: "texte", avecVisage: false, texteIncruste: false };
    const r = trierVideo([m], { sujet: "relances-impayes" });
    expect(r.ignores).toEqual({ nombre: 1, raisonPrincipale: "peu-d-interet" });
  });

  it("déterministe, entrées gelées non modifiées", () => {
    const entree = dix().map((m) => Object.freeze({ ...m }));
    Object.freeze(entree);
    const a = trierVideo(entree, CTX);
    const b = trierVideo(entree, CTX);
    expect(a).toEqual(b);
    expect(entree).toEqual(dix());
  });

  it("assignable à TriExtraits", () => {
    const t: (m: Moment[], c: ContexteNote, s: SeuilsNoteInteret) => ResultatTri = trierVideo;
    expect(typeof t).toBe("function");
  });

  it("garde statique : aucun import interdit", () => {
    const src = readFileSync("src/briques/archive-extraits/tri-video.ts", "utf8");
    for (const interdit of ["@/services", "depots", "reglages", "server-only"]) {
      expect(src.split("\n").filter((l) => /^\s*import\b/.test(l) && l.includes(interdit))).toEqual([]);
    }
  });
});
