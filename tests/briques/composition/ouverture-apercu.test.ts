import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  APERCU_OUVERTURE_ACTIF,
  DUREE_APERCU_MAX_MS,
  apercuDeLaFin,
  apercuPermisPour,
} from "../../../src/briques/composition/ouverture-apercu";
import { devantLeVisage } from "../../../src/briques/plan-scenes/zones";

type Entree = Parameters<typeof apercuDeLaFin>[0];
const scene = (id: string, piece: string, debutMs: number, finMs: number, position = "bas", extra: object = {}) =>
  ({ id, piece, debutMs, finMs, position, version: 1, niveau: 1, parametres: {}, ...extra }) as unknown as Entree["scenes"][number];
const plan = (scenes: Entree["scenes"], facecam = false) => ({ facecam, dureeMs: 20000, scenes }) as unknown as Entree;

describe("apercuPermisPour (décision E1-3)", () => {
  it("vrai seulement pour le tutoriel et la démo", () => {
    expect(apercuPermisPour("tutoriel-outil")).toBe(true);
    expect(apercuPermisPour("demo-facecam")).toBe(true);
    for (const g of ["facecam-animee", "cas-concret", "image-video", "tableau-anime", "avocat", "", "inconnu"]) expect(apercuPermisPour(g)).toBe(false);
  });
});

describe("apercuDeLaFin", () => {
  it("éteint par défaut", () => expect(APERCU_OUVERTURE_ACTIF).toBe(false));

  it("renvoie une scène qui existe dans le plan reçu, ≤ 1,2 s", () => {
    const p = plan([scene("a", "texte", 0, 3000), scene("r", "tableau-de-bord", 15000, 19000)]);
    const r = apercuDeLaFin(p, "tutoriel-outil");
    expect(r.type).toBe("apercu");
    if (r.type !== "apercu") return;
    expect(p.scenes.map((s) => s.id)).toContain(r.sceneId);
    expect(r.sceneId).toBe("r");
    expect(r.finMs - r.debutMs).toBeLessThanOrEqual(DUREE_APERCU_MAX_MS);
    expect(DUREE_APERCU_MAX_MS).toBe(1200);
    expect(r.debutMs).toBeGreaterThanOrEqual(15000);
    expect(r.finMs).toBeLessThanOrEqual(19000);
  });

  it("scène courte : durée de la scène", () => {
    const r = apercuDeLaFin(plan([scene("r", "graphique", 10000, 10800)]), "demo-facecam");
    expect(r).toMatchObject({ type: "apercu", sceneId: "r", debutMs: 10000, finMs: 10800 });
  });

  it("rien si aucune scène de résultat", () => {
    expect(apercuDeLaFin(plan([scene("a", "texte", 0, 3000), scene("b", "curseur", 4000, 5000)]), "tutoriel-outil")).toEqual({ type: "rien" });
    expect(apercuDeLaFin(plan([]), "tutoriel-outil")).toEqual({ type: "rien" });
  });

  it("rien si le générateur n'est pas permis", () => {
    const p = plan([scene("r", "tableau-de-bord", 15000, 19000)]);
    expect(apercuDeLaFin(p, "facecam-animee")).toEqual({ type: "rien" });
    expect(apercuDeLaFin(p, "cas-concret")).toEqual({ type: "rien" });
  });

  it("jamais de visage : position devant le visage ou calque devant le visage écartés", () => {
    expect(devantLeVisage("centre")).toBe(true);
    const p = plan([
      scene("ok", "graphique", 5000, 7000, "bas"),
      scene("visage", "tableau-de-bord", 15000, 19000, "centre"),
      scene("calque", "carte-kpi", 12000, 14000, "bas", { calques: [{ piece: "jauge", debutMs: 0, zone: "haut", parametres: {} }, { piece: "jauge", debutMs: 0, zone: "centre", parametres: {} }] }),
    ], true);
    const r = apercuDeLaFin(p, "demo-facecam");
    expect(r).toMatchObject({ type: "apercu", sceneId: "ok" });
    for (const s of p.scenes) if (s.id !== "ok") expect(apercuDeLaFin(plan([s], true), "demo-facecam")).toEqual({ type: "rien" });
  });

  it("sans facecam, la position plein écran est permise", () => {
    expect(apercuDeLaFin(plan([scene("r", "graphique", 5000, 7000, "plein")], false), "tutoriel-outil")).toMatchObject({ type: "apercu", sceneId: "r" });
    expect(apercuDeLaFin(plan([scene("r", "graphique", 5000, 7000, "plein")], true), "demo-facecam")).toEqual({ type: "rien" });
  });

  it("déterministe et sans mutation", () => {
    const p = plan([scene("r", "graphique", 5000, 9000)]);
    const copie = JSON.stringify(p);
    expect(apercuDeLaFin(p, "tutoriel-outil")).toEqual(apercuDeLaFin(p, "tutoriel-outil"));
    expect(JSON.stringify(p)).toBe(copie);
  });

  it("éteint = identique : aucun autre fichier ne l'importe", () => {
    const racines = ["src", "studio-rendu/src", "studio-rendu/compositions"];
    const trouves: string[] = [];
    const parcourir = (d: string) => {
      let noms: string[];
      try { noms = readdirSync(d); } catch { return; }
      for (const n of noms) {
        const c = join(d, n);
        if (statSync(c).isDirectory()) { if (n !== "node_modules") parcourir(c); }
        else if (/\.(ts|tsx)$/.test(n) && !c.endsWith("composition/ouverture-apercu.ts") && readFileSync(c, "utf8").includes("ouverture-apercu")) trouves.push(c);
      }
    };
    for (const r of racines) parcourir(r);
    expect(trouves).toEqual([]);
  });
});
