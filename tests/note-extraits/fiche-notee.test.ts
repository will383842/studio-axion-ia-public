import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { FicheSourceExtraits, PlageExtrait } from "@/domaine/archive-extraits";
import type { Moment, NoteMoment, ResultatTri } from "@/briques/note-extraits";
import { SEUILS_PAR_DEFAUT, VERSION_NOTE_EXTRAITS } from "@/briques/note-extraits";
import { empreinteNote, ficheAvecTri, plagesDepuisTri } from "@/services/note-extraits";

type Note = Moment & NoteMoment;

const moment = (id: string, decision: NoteMoment["decision"], note: number, extra: Partial<Note> = {}): Note => ({
  id,
  origine: "ecran-demo",
  debutSec: 0,
  finSec: 6,
  montre: "interface",
  texte: `texte ${id}`,
  avecVisage: false,
  texteIncruste: false,
  note,
  raisons: [{ code: "interface", points: note }],
  sujet: "suivi-commercial",
  usages: ["ecran"],
  decision,
  ...extra,
});

const tri = (gardes: Note[], peutEtre: Note[] = []): ResultatTri => ({
  gardes,
  peutEtre,
  ignores: { nombre: 2, raisonPrincipale: "visage" },
  rienARetenir: gardes.length + peutEtre.length === 0,
});

const plage = (id: string, extra: Partial<PlageExtrait> = {}): PlageExtrait => ({
  id,
  debutSec: 0,
  finSec: 6,
  texte: `texte ${id}`,
  motsCles: [],
  avecVisage: false,
  texteIncruste: false,
  etat: "utilisable",
  ...extra,
});

const fiche = (plages: PlageExtrait[]): FicheSourceExtraits => ({
  videoId: "v1",
  versionId: "ver1",
  sortieId: "s1",
  ratio: "9:16",
  licence: { type: "propriete", usageCommercial: true, reseaux: [] },
  famille: [],
  plages,
  rangee: true,
  sourcePreferee: true,
});

const gele = <T>(o: T): T => {
  const f = (x: unknown): void => {
    if (x && typeof x === "object" && !Object.isFrozen(x)) {
      Object.freeze(x);
      Object.values(x).forEach(f);
    }
  };
  f(o);
  return o;
};

describe("plagesDepuisTri", () => {
  it("gardé → utilisable, peut-être → a_verifier (note-moyenne), avec les champs de la note", () => {
    const p = plagesDepuisTri(tri([moment("g1", "garde", 80)], [moment("m1", "peut-etre", 50)]));
    expect(p).toHaveLength(2);
    expect(p[0]).toMatchObject({
      id: "g1",
      etat: "utilisable",
      origine: "ecran-demo",
      note: 80,
      raisonsNote: [{ code: "interface", points: 80 }],
      sujet: "suivi-commercial",
      usages: ["ecran"],
    });
    expect(p[0].raisonExclusion).toBeUndefined();
    expect(p[1]).toMatchObject({ id: "m1", etat: "a_verifier", raisonExclusion: "note-moyenne", note: 50 });
  });

  it("sujet nul → pas de champ sujet", () => {
    const [p] = plagesDepuisTri(tri([moment("g1", "garde", 80, { sujet: null })]));
    expect(p.sujet).toBeUndefined();
  });
});

describe("ficheAvecTri", () => {
  it("une plage écartée par Williams reste écartée après un tri qui la garde", () => {
    const f = fiche([plage("g1", { etat: "ecartee", ecarteeLe: "2026-11-01" })]);
    const r = ficheAvecTri(f, tri([moment("g1", "garde", 90)]), SEUILS_PAR_DEFAUT);
    expect(r.plages).toHaveLength(1);
    expect(r.plages[0]).toMatchObject({ id: "g1", etat: "ecartee", ecarteeLe: "2026-11-01" });
  });

  it("une plage écartée que le tri ne retient plus n'est pas perdue", () => {
    const f = fiche([plage("vieux", { etat: "ecartee", ecarteeLe: "2026-11-01" })]);
    const r = ficheAvecTri(f, tri([moment("g1", "garde", 90)]), SEUILS_PAR_DEFAUT);
    expect(r.plages.map((p) => p.id).sort()).toEqual(["g1", "vieux"]);
    expect(r.plages.find((p) => p.id === "vieux")?.etat).toBe("ecartee");
  });

  it("une plage validée par Williams reste gardée sous le seuil", () => {
    const f = fiche([plage("m1", { etat: "a_verifier", valideeLe: "2026-11-02" })]);
    const r = ficheAvecTri(f, tri([], [moment("m1", "peut-etre", 41)]), SEUILS_PAR_DEFAUT);
    expect(r.plages[0]).toMatchObject({ id: "m1", etat: "utilisable", valideeLe: "2026-11-02" });
    expect(r.plages[0].raisonExclusion).toBeUndefined();
  });

  it("une plage validée que le tri ignore désormais reste gardée", () => {
    const f = fiche([plage("m1", { valideeLe: "2026-11-02", sujet: "autre" })]);
    const r = ficheAvecTri(f, tri([moment("g1", "garde", 90)]), SEUILS_PAR_DEFAUT);
    expect(r.plages.find((p) => p.id === "m1")).toMatchObject({ etat: "utilisable", valideeLe: "2026-11-02" });
  });

  it("un sujet corrigé n'est jamais réécrit", () => {
    const f = fiche([plage("g1", { sujet: "relance-factures", sujetCorrigeLe: "2026-11-03" })]);
    const r = ficheAvecTri(f, tri([moment("g1", "garde", 90, { sujet: "suivi-commercial" })]), SEUILS_PAR_DEFAUT);
    expect(r.plages[0]).toMatchObject({ sujet: "relance-factures", sujetCorrigeLe: "2026-11-03" });
  });

  it("sans correction, le sujet du tri s'applique", () => {
    const f = fiche([plage("g1", { sujet: "relance-factures" })]);
    const r = ficheAvecTri(f, tri([moment("g1", "garde", 90)]), SEUILS_PAR_DEFAUT);
    expect(r.plages[0].sujet).toBe("suivi-commercial");
    expect(r.plages[0].sujetCorrigeLe).toBeUndefined();
  });

  it("renseigne ignores, noteVersion et rienARetenir (false si des plages restent)", () => {
    const r = ficheAvecTri(fiche([]), tri([moment("g1", "garde", 90)]), SEUILS_PAR_DEFAUT);
    expect(r.ignores).toEqual({ nombre: 2, raisonPrincipale: "visage" });
    expect(r.noteVersion).toBe(VERSION_NOTE_EXTRAITS);
    expect(r.rienARetenir).toBe(false);
  });

  it("tri vide → rienARetenir: true, aucune plage neuve", () => {
    const r = ficheAvecTri(fiche([]), tri([]), SEUILS_PAR_DEFAUT);
    expect(r.rienARetenir).toBe(true);
    expect(r.plages).toEqual([]);
    expect(r.noteVersion).toBe(VERSION_NOTE_EXTRAITS);
  });

  it("tri vide mais geste de Williams conservé → rienARetenir reste faux", () => {
    const f = fiche([plage("v", { valideeLe: "2026-11-02" })]);
    const r = ficheAvecTri(f, tri([]), SEUILS_PAR_DEFAUT);
    expect(r.plages).toHaveLength(1);
    expect(r.rienARetenir).toBe(false);
  });

  it("deux appels identiques → même fiche (égalité profonde)", () => {
    const f = fiche([plage("g1", { etat: "ecartee", ecarteeLe: "2026-11-01" })]);
    const t = tri([moment("g1", "garde", 90), moment("g2", "garde", 70)], [moment("m1", "peut-etre", 45)]);
    expect(ficheAvecTri(f, t, SEUILS_PAR_DEFAUT)).toEqual(ficheAvecTri(f, t, SEUILS_PAR_DEFAUT));
  });

  it("les entrées gelées ne sont pas modifiées", () => {
    const f = gele(fiche([plage("g1", { etat: "ecartee", ecarteeLe: "2026-11-01", sujetCorrigeLe: "2026-11-03" })]));
    const t = gele(tri([moment("g1", "garde", 90)], [moment("m1", "peut-etre", 45)]));
    const avant = JSON.stringify([f, t]);
    const r = ficheAvecTri(f, t, gele({ ...SEUILS_PAR_DEFAUT }));
    expect(JSON.stringify([f, t])).toBe(avant);
    expect(r).not.toBe(f);
    expect(r.plages).not.toBe(f.plages);
  });
});

describe("empreinteNote", () => {
  it("contient la version et les seuils, change quand un seuil change", () => {
    const a = empreinteNote(SEUILS_PAR_DEFAUT);
    expect(a).toContain(VERSION_NOTE_EXTRAITS);
    expect(a).toBe(empreinteNote({ ...SEUILS_PAR_DEFAUT }));
    expect(empreinteNote({ ...SEUILS_PAR_DEFAUT, garde: 70 })).not.toBe(a);
    expect(empreinteNote({ ...SEUILS_PAR_DEFAUT, peutEtre: 30 })).not.toBe(a);
    expect(empreinteNote({ ...SEUILS_PAR_DEFAUT, gardesMax: 5 })).not.toBe(a);
  });
});

describe("garde statique", () => {
  it("aucun import de depots, reglages ni @/fournisseurs/", () => {
    const src = readFileSync("src/services/note-extraits.ts", "utf8");
    const imports = src.split("\n").filter((l) => /^\s*(import|export)\b.*\bfrom\b/.test(l));
    for (const l of imports) {
      expect(l).not.toMatch(/depots|reglages|@\/fournisseurs\//);
    }
  });
});
