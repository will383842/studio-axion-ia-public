/** C5-5.08a · porte pure du dessin du plan de scènes face caméra (non branchée, éteinte). */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ID } from "@/briques/bibliotheque-video/noms";
import { profilNeutre } from "@/briques/bibliotheque-video/profils";
import type { EntreeBibliotheque, ProfilVideo, RegleProfilCapacite } from "@/briques/bibliotheque-video/types";
import { VERSION_BIBLIOTHEQUE } from "@/briques/bibliotheque-video/version";
import { bandeSousTitres, filtrerPlanFacecam } from "@/briques/plan-scenes-generateurs/dessin-facecam";
import {
  CLE_REGLAGE_DESSIN_FACECAM,
  dessinFacecamPermis,
  dessinFacecamReglage,
  planFacecamPourSupplements,
} from "@/briques/plan-scenes-generateurs/dessin-facecam-porte";
import { planPourVideo, type MotEnSecondes } from "@/briques/plan-scenes-generateurs/video";
import type { FormatPlan, PlanValide } from "@/briques/plan-scenes/schema";

const SCRIPT =
  "Aujourd'hui je vous montre comment ranger un bureau en 30 jours. Ouvrez le tiroir, cliquez sur le bouton Nouveau dossier puis choisissez le modèle. Résultat : 87 % de collègues satisfaits et 3 fois plus de place.";
const MOTS: MotEnSecondes[] = SCRIPT.split(" ").map((texte, i) => ({ texte, debutSec: i * 0.4, finSec: i * 0.4 + 0.35 }));
const DUREE_SEC = MOTS.length * 0.4 + 0.5;
const FORMAT: FormatPlan = { largeur: 1080, hauteur: 1920, fps: 25 };

async function plan(): Promise<PlanValide> {
  const m = await planPourVideo({ generateur: "facecam", mots: MOTS, dureeSec: DUREE_SEC, facecam: true, format: FORMAT });
  if (!m.plan) throw new Error("plan absent");
  return m.plan;
}

function entrees(capacites: Partial<Record<string, RegleProfilCapacite>> = {}, verrous: string[] = []) {
  const base = profilNeutre("format-essai");
  const profil: ProfilVideo = { ...base, capacites: capacites as ProfilVideo["capacites"], verrous };
  const e: EntreeBibliotheque = { version: VERSION_BIBLIOTHEQUE, profil, recents: [], graine: "G", figeeLe: "2026-11-16" };
  return { bibliothequeVideo: e };
}

describe("C5-5.08a · dessinFacecamReglage", () => {
  it("lit exactement (clé, true) : allumé par défaut", async () => {
    const appels: unknown[][] = [];
    await dessinFacecamReglage(async (...a) => (appels.push(a), true));
    expect(appels).toEqual([["planScenes.facecamDessin", true]]);
    expect(CLE_REGLAGE_DESSIN_FACECAM).toBe("planScenes.facecamDessin");
  });
  it("seul false exact éteint (éteint explicitement = comme avant)", async () => {
    expect(await dessinFacecamReglage(async () => false)).toBe(false);
    for (const v of [true, "true", "false", 1, 0, null, undefined, {}]) expect(await dessinFacecamReglage(async () => v)).toBe(true);
  });
  it("rejet ou exception → défaut allumé", async () => {
    expect(await dessinFacecamReglage(async () => { throw new Error("x"); })).toBe(true);
    expect(await dessinFacecamReglage(() => { throw new Error("x"); })).toBe(true);
  });
});

describe("C5-5.08a · dessinFacecamPermis", () => {
  const valeurs: unknown[] = [true, false, "true"];
  it("sans entrée : vrai seulement pour (true, true)", () => {
    for (const f of valeurs) for (const d of valeurs) {
      expect(dessinFacecamPermis({ planScenesFacecam: f, dessin: d, entrees: {} })).toBe(f === true && d === true);
    }
  });
  it("avec entrée : la permission du profil décide", () => {
    const ok = { planScenesFacecam: true, dessin: true };
    expect(dessinFacecamPermis({ ...ok, entrees: entrees({ [ID.planScenesFacecam]: { permis: true } }) })).toBe(true);
    expect(dessinFacecamPermis({ ...ok, entrees: entrees({ [ID.planScenesFacecam]: { permis: false } }) })).toBe(false);
    expect(dessinFacecamPermis({ ...ok, entrees: entrees() })).toBe(false);
    expect(dessinFacecamPermis({ ...ok, entrees: entrees({ [ID.planScenesFacecam]: { permis: true } }, ["plan-scenes"]) })).toBe(false);
    expect(dessinFacecamPermis({ ...ok, entrees: entrees({ [ID.planScenesFacecam]: { permis: true } }, ["plan-scenes.facecam"]) })).toBe(false);
  });
  it("avec entrée permise mais un réglage éteint → false", () => {
    const e = entrees({ [ID.planScenesFacecam]: { permis: true } });
    expect(dessinFacecamPermis({ planScenesFacecam: false, dessin: true, entrees: e })).toBe(false);
    expect(dessinFacecamPermis({ planScenesFacecam: true, dessin: false, entrees: e })).toBe(false);
  });
  it("entrée piège (getter qui lève) : sans exception", () => {
    const piege = { get bibliothequeVideo(): unknown { throw new Error("piège"); } };
    expect(() => dessinFacecamPermis({ planScenesFacecam: true, dessin: true, entrees: piege })).not.toThrow();
    const r = dessinFacecamPermis({ planScenesFacecam: true, dessin: true, entrees: piege });
    expect(typeof r).toBe("boolean");
    const objet = { planScenesFacecam: true, get dessin(): unknown { throw new Error("piège"); }, entrees: {} };
    expect(dessinFacecamPermis(objet)).toBe(false);
  });
});

describe("C5-5.08a · planFacecamPourSupplements", () => {
  const bande = bandeSousTitres("9:16", FORMAT);
  it("permis false → même objet, rien retiré", async () => {
    const p = await plan();
    const r = planFacecamPourSupplements(p, { permis: false, bande });
    expect(r.plan).toBe(p);
    expect(r.retirees).toEqual([]);
  });
  it("plan absent → undefined", () => {
    expect(planFacecamPourSupplements(undefined, { permis: true, bande })).toEqual({ plan: undefined, retirees: [] });
    expect(planFacecamPourSupplements(undefined, { permis: false, bande })).toEqual({ plan: undefined, retirees: [] });
  });
  it("permis true → identique à filtrerPlanFacecam, pièce « bas » retirée", async () => {
    const p = await plan();
    const r = planFacecamPourSupplements(p, { permis: true, bande });
    expect(r).toEqual(filtrerPlanFacecam(p, { bande }));
    expect(r.retirees.map((x) => x.raison)).toContain("sous-titres");
    expect(r.plan?.scenes.some((s) => s.position === "bas")).toBe(false);
  });
  it("occupes transmis : une carte sur toute la durée retire tout (raison « carte »)", async () => {
    const p = await plan();
    const occupes = [{ debutSec: 0, finSec: DUREE_SEC + 10 }];
    const r = planFacecamPourSupplements(p, { permis: true, bande, occupes });
    expect(r).toEqual(filtrerPlanFacecam(p, { bande, occupes }));
    expect(r.retirees.some((x) => x.raison === "carte")).toBe(true);
    expect(r.plan?.scenes.length).toBe(p.scenes.length - r.retirees.length);
  });
  it("entrées gelées : aucune modification", async () => {
    const p = await plan();
    const profond = (o: unknown): void => { if (o && typeof o === "object") { Object.freeze(o); Object.values(o).forEach(profond); } };
    profond(p);
    const occupes = Object.freeze([Object.freeze({ debutSec: 0, finSec: 5 })]) as unknown as { debutSec: number; finSec: number }[];
    const avant = JSON.stringify(p);
    expect(() => planFacecamPourSupplements(p, { permis: true, bande, occupes })).not.toThrow();
    expect(JSON.stringify(p)).toBe(avant);
  });
});

describe("C5-5.08a · garde de source", () => {
  const src = readFileSync(join(process.cwd(), "src/briques/plan-scenes-generateurs/dessin-facecam-porte.ts"), "utf8");
  it("aucune dépendance interdite", () => {
    for (const interdit of ["lireParametre", "@/services", "studio-rendu"]) expect(src).not.toContain(interdit);
    expect(src).not.toMatch(/Math\.random|Date\.now/);
  });
  it("l'import de ./reglage est un import type", () => {
    const lignes = src.split("\n").filter((l) => /from\s+["']\.\/reglage["']/.test(l));
    expect(lignes.length).toBe(1);
    expect(lignes[0]).toMatch(/^import type /);
  });
});
