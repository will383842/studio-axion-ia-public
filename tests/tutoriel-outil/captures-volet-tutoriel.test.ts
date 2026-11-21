/** N-05-VOLET-f-v20j : copie de rendu du plan avec les 2 captures signées à l'instant. Aucun appelant, aucun appel réel. */
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { PLAN_DEMO } from "@/briques/plan-scenes/demo";
import { validerPlan } from "@/briques/plan-scenes/validateur";
import { validerVoletPlan } from "@/briques/plan-scenes/briques/volet-plan";
import type { PlanValide } from "@/briques/plan-scenes/schema";

vi.mock("server-only", () => ({}));
const { copieDeRenduAvecVolet } = await import("@/services/captures-volet-tutoriel");

const VOLET = "objet-volet-avant-apres";
const MOTS = "J'ai gagné 42 heures cette semaine".split(" ").map((texte, i) => ({ texte, debutMs: i * 400, finMs: i * 400 + 350 }));
const contexte = { mots: MOTS, format: { largeur: 1080, hauteur: 1920, fps: 25 as const }, facecam: false };
const permis = { ...contexte, objetsPermis: [VOLET] };

const planVolet = (): PlanValide => {
  const p = structuredClone(PLAN_DEMO) as unknown as { scenes: Record<string, unknown>[] };
  p.scenes = [{ id: "o", version: 1, mots: { premier: 0, dernier: MOTS.length - 1 }, debutMs: 0, finMs: 4000, niveau: 1, position: "centre", transition: { entree: "fondu", sortie: "fondu", dureeMs: 400 }, piece: VOLET, parametres: { etiquettes: true } }];
  return validerPlan(p, permis).plan;
};
const planSans = (): PlanValide => validerPlan(PLAN_DEMO, contexte).plan;
const projet = (...cles: string[]) => ({ captures: cles.map((cle) => ({ cle, largeur: 1280, hauteur: 800, empreinte: `e-${cle}`, zones: [] })) });
const volets = (p: PlanValide) => (p as unknown as { scenes: { piece: string; parametres: Record<string, unknown> }[] }).scenes.filter((s) => s.piece === VOLET);
const signeur = () => vi.fn(async (cle: string) => `https://signe/${cle}?t=1`);

describe("copieDeRenduAvecVolet", () => {
  it("a) plan sans volet : même référence, 0 signature", async () => {
    const signer = signeur();
    const p = planSans();
    expect(await copieDeRenduAvecVolet(p, projet("c1", "c2", "c3"), { signer })).toBe(p);
    expect(signer).not.toHaveBeenCalled();
  });

  it("b) volet + 3 captures : signe c1 puis c3, adresses posées", async () => {
    const signer = signeur();
    const copie = await copieDeRenduAvecVolet(planVolet(), projet("c1", "c2", "c3"), { signer });
    expect(signer.mock.calls.map((c) => c[0])).toEqual(["c1", "c3"]);
    const v = volets(copie);
    expect(v).toHaveLength(1);
    expect(v[0]!.parametres).toMatchObject({ avant: "https://signe/c1?t=1", apres: "https://signe/c3?t=1" });
  });

  it("c) 0 ou 1 capture, projet illisible : volet retiré, 0 signature", async () => {
    for (const x of [projet(), projet("c1"), null, "x", undefined]) {
      const signer = signeur();
      const copie = await copieDeRenduAvecVolet(planVolet(), x, { signer });
      expect(volets(copie)).toHaveLength(0);
      expect(signer).not.toHaveBeenCalled();
    }
  });

  it("d) signer qui lève, rend vide ou deux adresses identiques : volet retiré, aucune exception", async () => {
    const leve = vi.fn(async () => { throw new Error("stockage"); });
    const vide = vi.fn(async () => "");
    const pareil = vi.fn(async () => "https://signe/meme");
    for (const signer of [leve, vide, pareil]) {
      const copie = await copieDeRenduAvecVolet(planVolet(), projet("c1", "c2"), { signer });
      expect(volets(copie)).toHaveLength(0);
    }
  });

  it("e) plan et projet strictement inchangés", async () => {
    const p = planVolet();
    const pr = projet("c1", "c2", "c3");
    const p0 = JSON.stringify(p);
    const pr0 = JSON.stringify(pr);
    await copieDeRenduAvecVolet(p, pr, { signer: signeur() });
    expect(JSON.stringify(p)).toBe(p0);
    expect(JSON.stringify(pr)).toBe(pr0);
  });

  it("f) sûreté : le plan gardé garde son volet, la copie re-validée le perd", async () => {
    const garde = planVolet();
    expect(volets(validerPlan(garde, permis).plan)).toHaveLength(1);
    const copie = await copieDeRenduAvecVolet(garde, projet("c1", "c2"), { signer: signeur() });
    const v = volets(copie);
    expect(v).toHaveLength(1);
    expect(validerVoletPlan(v[0]!.parametres)).toBeNull();
    const r = validerPlan(copie, permis);
    expect(volets(r.plan).every((s) => !("avant" in s.parametres))).toBe(true);
    expect(r.remarques.some((x) => x.code === "SCENE_RETIREE")).toBe(true);
  });

  it("g) garde statique du module", () => {
    const t = readFileSync("src/services/captures-volet-tutoriel.ts", "utf8");
    expect(t).toContain("server-only");
    for (const interdit of ["lireParametre", "stockage", "fetch", "@/services/", "prisma", "centimes"]) expect(t).not.toContain(interdit);
    const imports = [...t.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]!).filter((s) => s.includes("montage-tutoriel-outil"));
    expect(imports).toEqual(["@/moteurs/montage-tutoriel-outil/artefacts-retouche"]);
  });
});
