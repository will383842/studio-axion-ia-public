import { describe, expect, it } from "vitest";
import { verifierEspacement, prochainJourLibre, REGLES_PAR_DEFAUT, type PostPlanifie } from "@/domaine/cadence/verifier";
import { cleCadence } from "@/domaine/cadence/empreinte";

const p = (id: string, jour: string, heure: string, extra: Partial<PostPlanifie> = {}): PostPlanifie => ({
  id, reseau: "linkedin", jour, heure, pilier: "preuve", cible: "dirigeant", ...extra,
});
const regles = { ...REGLES_PAR_DEFAUT, ecartMinH: 24 };

describe("vérification d'espacement", () => {
  it("deux LinkedIn à 20 h d'écart avec 24 h minimum = violation", () => {
    const r = verifierEspacement([p("a", "2026-12-01", "08:00", { pilier: "x" }), p("b", "2026-12-02", "04:00", { pilier: "y" })], regles);
    expect(r.filter((v) => v.niveau === "violation" && v.code === "ecart")).toHaveLength(1);
  });
  it("25 h d'écart = aucune violation d'écart", () => {
    const r = verifierEspacement([p("a", "2026-12-01", "08:00", { pilier: "x" }), p("b", "2026-12-02", "09:00", { pilier: "y" })], regles);
    expect(r.filter((v) => v.code === "ecart")).toEqual([]);
  });
  it("un autre réseau n'entre pas dans l'écart", () => {
    const r = verifierEspacement([p("a", "2026-12-01", "08:00"), p("b", "2026-12-01", "09:00", { reseau: "tiktok", pilier: "z" })], regles);
    expect(r).toEqual([]);
  });
  it("quota dépassé = avertissement (2 LinkedIn le 03/12)", () => {
    const r = verifierEspacement([p("a", "2026-12-03", "08:00", { pilier: "x" }), p("b", "2026-12-03", "14:00", { pilier: "y" })], { ...REGLES_PAR_DEFAUT, ecartMinH: 3 });
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ code: "quota", niveau: "avertissement" });
  });
  it("même pilier + même cible le même jour = violation, accepté à J+4", () => {
    const meme = verifierEspacement([p("a", "2026-12-01", "08:00"), p("b", "2026-12-01", "16:00", { reseau: "tiktok" })], REGLES_PAR_DEFAUT);
    expect(meme.some((v) => v.code === "repetition" && v.niveau === "violation")).toBe(true);
    const j3 = verifierEspacement([p("a", "2026-12-01", "08:00"), p("b", "2026-12-04", "08:00")], REGLES_PAR_DEFAUT);
    expect(j3.some((v) => v.code === "repetition")).toBe(true);
    const j4 = verifierEspacement([p("a", "2026-12-01", "08:00"), p("b", "2026-12-05", "08:00")], REGLES_PAR_DEFAUT);
    expect(j4.some((v) => v.code === "repetition")).toBe(false);
  });
  it("pilier ou cible différent : pas de répétition ; clé insensible à la casse et aux accents", () => {
    expect(cleCadence(p("a", "2026-12-01", "08:00", { pilier: "Preuve", cible: "Dirigeant·e" }))).toBe(cleCadence(p("b", "2026-12-01", "08:00", { pilier: "preuvé", cible: "dirigeant·e" })));
    const r = verifierEspacement([p("a", "2026-12-01", "08:00"), p("b", "2026-12-01", "20:00", { cible: "artisan" })], { ...REGLES_PAR_DEFAUT, ecartMinH: 3 });
    expect(r.some((v) => v.code === "repetition")).toBe(false);
  });
  it("un samedi LinkedIn → lundi libre", () => {
    expect(prochainJourLibre("linkedin", "2026-12-05", [], REGLES_PAR_DEFAUT)).toBe("2026-12-07");
    expect(prochainJourLibre("linkedin", "2026-12-03", [], REGLES_PAR_DEFAUT)).toBe("2026-12-03");
    expect(prochainJourLibre("linkedin", "2026-12-03", [p("a", "2026-12-03", "08:00")], REGLES_PAR_DEFAUT)).toBe("2026-12-04");
    expect(prochainJourLibre("linkedin", "2026-12-04", [p("a", "2026-12-04", "08:00")], REGLES_PAR_DEFAUT)).toBe("2026-12-07");
  });
  it("un post LinkedIn posé un samedi est signalé en avertissement", () => {
    const r = verifierEspacement([p("a", "2026-12-05", "08:00")], REGLES_PAR_DEFAUT);
    expect(r).toEqual([expect.objectContaining({ code: "weekend", niveau: "avertissement" })]);
  });
  it("traverse le changement d'heure sans décalage de 1 h", () => {
    // 24/10 08:00 → 25/10 07:30 (heure d'hiver) = 24,5 h réelles ; 24/10 08:00 → 25/10 06:30 = 23,5 h
    const ok = verifierEspacement([p("a", "2026-10-24", "08:00", { pilier: "x" }), p("b", "2026-10-25", "07:30", { pilier: "y" })], regles);
    expect(ok.some((v) => v.code === "ecart")).toBe(false);
    const ko = verifierEspacement([p("a", "2026-10-24", "08:00", { pilier: "x" }), p("b", "2026-10-25", "06:30", { pilier: "y" })], regles);
    expect(ko.some((v) => v.code === "ecart")).toBe(true);
  });
});
