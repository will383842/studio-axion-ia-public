import { describe, expect, it } from "vitest";
import { repartirLot, SEMAINES_MAX, SEMAINES_MIN } from "@/services/cadence-lot";
import { planifierLot, type SujetAPlanifier } from "@/domaine/cadence/planifier";
import { verifierEspacement, type PostPlanifie } from "@/domaine/cadence/verifier";

const LUNDI = "2026-12-07";
const sujet = (n: number): SujetAPlanifier => ({ id: `s${String(n).padStart(2, "0")}`, pilier: `pilier-${n}`, cible: "dirigeant" });
const douze = Array.from({ length: 12 }, (_, i) => sujet(i + 1));
const posts = (r: { creneaux: PostPlanifie[] }) => r.creneaux.map(({ id, reseau, jour, heure, pilier, cible }) => ({ id, reseau, jour, heure, pilier, cible }));
const violations = (p: PostPlanifie[]) => verifierEspacement(p).filter((v) => v.niveau === "violation");

describe("répartir un lot sur 2 à 4 semaines", () => {
  it("12 éléments sur 3 semaines : zéro violation dure, tous placés dans la fenêtre", () => {
    const r = repartirLot(LUNDI, 3, douze, ["linkedin", "instagram"], []);
    expect(r.erreur).toBeUndefined();
    expect(r.creneaux).toHaveLength(24);
    expect(r.violations).toEqual([]);
    for (const c of r.creneaux) expect(c.jour >= LUNDI && c.jour <= "2026-12-27").toBe(true);
    expect(r.horsFenetre).toEqual([]);
    expect(r.creneaux.length).toBe(24);
  });

  it("un seul réseau : zéro violation au sens strict du noyau d'espacement", () => {
    const r = repartirLot(LUNDI, 3, douze, ["linkedin"], []);
    expect(violations(posts(r))).toEqual([]);
    expect(r.horsFenetre).toEqual([]);
  });

  it("répartit vraiment : les trois semaines reçoivent des éléments (pas tout au début)", () => {
    const r = repartirLot(LUNDI, 3, douze, ["linkedin"], []);
    const semaine = (j: string) => Math.floor((Date.parse(j) - Date.parse(LUNDI)) / 6.048e8);
    expect(new Set(r.creneaux.map((c) => semaine(c.jour)))).toEqual(new Set([0, 1, 2]));
  });

  it("même plan à la relance, quel que soit l'ordre d'entrée", () => {
    const a = repartirLot(LUNDI, 3, douze, ["linkedin", "tiktok"], []);
    const b = repartirLot(LUNDI, 3, [...douze].reverse(), ["linkedin", "tiktok"], []);
    expect(b).toEqual(a);
  });

  it("relance après enregistrement : le plan posé par le lot ne compte pas contre lui", () => {
    const a = repartirLot(LUNDI, 3, douze, ["linkedin"], []);
    const deja = a.creneaux.map((c) => ({ ...c }));
    expect(repartirLot(LUNDI, 3, douze, ["linkedin"], deja)).toEqual(a);
  });

  it("réutilise le moteur de placement : un seul élément = planifierLot", () => {
    const r = repartirLot(LUNDI, 2, [sujet(1)], ["linkedin", "tiktok"], []);
    expect(r.creneaux).toEqual(planifierLot(LUNDI, [sujet(1)], ["linkedin", "tiktok"], []));
  });

  it("respecte les posts déjà planifiés", () => {
    const pris: PostPlanifie = { id: "autre", reseau: "linkedin", jour: LUNDI, heure: "09:00", pilier: "z", cible: "z" };
    const r = repartirLot(LUNDI, 2, [sujet(1)], ["linkedin"], [pris]);
    expect(r.creneaux[0].jour).not.toBe(LUNDI);
    expect(violations([pris, ...posts(r)])).toEqual([]);
  });

  it("même pilier et même cible : jamais à moins de 4 jours", () => {
    const memes = [1, 2, 3].map((n) => ({ id: `m${n}`, pilier: "p", cible: "c" }));
    const r = repartirLot(LUNDI, 2, memes, ["linkedin"], []);
    expect(violations(posts(r))).toEqual([]);
  });

  it("signale ce qui sort de la fenêtre au lieu de le cacher", () => {
    const vingt = Array.from({ length: 20 }, (_, i) => sujet(i + 1));
    const r = repartirLot(LUNDI, 2, vingt, ["linkedin"], []);
    expect(r.horsFenetre.length).toBeGreaterThan(0);
    expect(violations(posts(r))).toEqual([]);
  });

  it("cas limites : semaines hors 2 à 4, date illisible ou inexistante, lot vide, aucun réseau", () => {
    expect(SEMAINES_MIN).toBe(2);
    expect(SEMAINES_MAX).toBe(4);
    for (const s of [1, 5, 0, -1, 2.5, Number.NaN]) expect(repartirLot(LUNDI, s, douze, ["linkedin"], []).erreur).toBeTruthy();
    for (const d of ["", "demain", "2026-02-30", "2026-12-7"]) expect(repartirLot(d, 3, douze, ["linkedin"], []).erreur).toBeTruthy();
    expect(repartirLot(LUNDI, 3, [], ["linkedin"], []).erreur).toBeTruthy();
    expect(repartirLot(LUNDI, 3, douze, [], []).erreur).toBeTruthy();
    expect(repartirLot(LUNDI, 3, douze, ["linkedin"], []).erreur).toBeUndefined();
    expect(repartirLot(LUNDI, 2, douze, ["linkedin"], []).erreur).toBeUndefined();
    expect(repartirLot(LUNDI, 4, douze, ["linkedin"], []).erreur).toBeUndefined();
  });

  it("départ un samedi ou le jour du changement d'heure : aucun week-end LinkedIn, aucune violation", () => {
    for (const debut of ["2026-12-05", "2027-03-27"]) {
      const r = repartirLot(debut, 3, douze, ["linkedin"], []);
      for (const c of r.creneaux) expect([0, 6]).not.toContain(new Date(`${c.jour}T00:00:00Z`).getUTCDay());
      expect(violations(posts(r))).toEqual([]);
    }
  });

  it("n'écrit rien : le résultat est de la donnée, les entrées ne changent pas", () => {
    const entree = douze.map((s) => ({ ...s }));
    const copie = structuredClone(entree);
    repartirLot(LUNDI, 3, entree, ["linkedin"], []);
    expect(entree).toEqual(copie);
  });
});
