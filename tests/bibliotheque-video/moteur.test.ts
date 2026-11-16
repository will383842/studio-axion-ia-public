import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { bibliothequeDeLaCommande, porteCapacite } from "@/briques/bibliotheque-video/moteur";
import { ID } from "@/briques/bibliotheque-video/noms";
import { profilNeutre } from "@/briques/bibliotheque-video/profils";
import type { EntreeBibliotheque, ProfilVideo, RegleProfilCapacite } from "@/briques/bibliotheque-video/types";
import { VERSION_BIBLIOTHEQUE } from "@/briques/bibliotheque-video/version";

const ID_TEXTE = ID.texteStyleVarie;

function entree(capacites: Partial<Record<string, RegleProfilCapacite>> = {}, verrous: string[] = []): EntreeBibliotheque {
  const base = profilNeutre("format-essai");
  const profil: ProfilVideo = { ...base, capacites: capacites as ProfilVideo["capacites"], verrous };
  return { version: VERSION_BIBLIOTHEQUE, profil, recents: [{ capacite: ID_TEXTE, cle: "k0", videoId: "v0" }], graine: "G", figeeLe: "2026-11-16" };
}
const entrees = (e: EntreeBibliotheque) => ({ bibliothequeVideo: e });

describe("porteCapacite (C1-U10)", () => {
  it.each([
    ["undefined", undefined],
    ["objet vide", {}],
    ["chaîne", { bibliothequeVideo: "x" }],
    ["version inconnue", { bibliothequeVideo: { ...entree(), version: "bibliotheque-video/99" } }],
    ["null", null],
  ])("sans entrée lisible (%s) → { bibliotheque: false }", (_n, e) => {
    expect(porteCapacite(e, ID_TEXTE)).toEqual({ bibliotheque: false });
  });

  it("règle permis: true → permis", () => {
    expect(porteCapacite(entrees(entree({ [ID_TEXTE]: { permis: true } })), ID_TEXTE)).toEqual({ bibliotheque: true, permis: true });
  });
  it("règle absente → permis: false", () => {
    expect(porteCapacite(entrees(entree()), ID_TEXTE)).toEqual({ bibliotheque: true, permis: false });
  });
  it("règle permis: false → permis: false", () => {
    expect(porteCapacite(entrees(entree({ [ID_TEXTE]: { permis: false } })), ID_TEXTE)).toEqual({ bibliotheque: true, permis: false });
  });
  it("verrou sur l'id → permis: false", () => {
    expect(porteCapacite(entrees(entree({ [ID_TEXTE]: { permis: true } }, [ID_TEXTE])), ID_TEXTE)).toEqual({ bibliotheque: true, permis: false });
  });
  it("verrou sur la famille → permis: false", () => {
    expect(porteCapacite(entrees(entree({ [ID_TEXTE]: { permis: true } }, ["texte"])), ID_TEXTE)).toEqual({ bibliotheque: true, permis: false });
  });
  it("maxParVideo recopié", () => {
    expect(porteCapacite(entrees(entree({ [ID_TEXTE]: { permis: true, maxParVideo: 2 } })), ID_TEXTE)).toEqual({ bibliotheque: true, permis: true, maxParVideo: 2 });
  });
  it("jamais d'exception : getter qui lève, Proxy", () => {
    const piege = { get bibliothequeVideo(): unknown { throw new Error("piège"); } };
    expect(porteCapacite(piege, ID_TEXTE)).toEqual({ bibliotheque: false });
    const proxy = new Proxy({}, { get() { throw new Error("proxy"); }, has() { throw new Error("proxy"); } });
    expect(porteCapacite(proxy, ID_TEXTE)).toEqual({ bibliotheque: false });
    expect(bibliothequeDeLaCommande({ entrees: piege })).toBeNull();
    expect(bibliothequeDeLaCommande({ entrees: proxy as never })).toBeNull();
  });
});

describe("bibliothequeDeLaCommande (C1-U10)", () => {
  it("null sans entrée ou illisible", () => {
    expect(bibliothequeDeLaCommande({ entrees: {} })).toBeNull();
    expect(bibliothequeDeLaCommande({ entrees: { bibliothequeVideo: "x" } })).toBeNull();
  });
  it("avec entrée : historique = recents, choisir utilisable", () => {
    const e = entree({ [ID_TEXTE]: { permis: true } });
    const l = bibliothequeDeLaCommande({ entrees: entrees(e) });
    expect(l).not.toBeNull();
    expect(l!.historique).toEqual(e.recents);
    const cands = Array.from({ length: 4 }, (_, i) => ({ id: `i${i}`, capacite: ID_TEXTE, cle: `k${i}` }));
    const r = l!.choisir({ capacite: ID_TEXTE, nombre: 1 }, cands);
    expect(r).toBeDefined();
    expect(typeof r).toBe("object");
  });
});

describe("garde statique (C1-U10)", () => {
  const src = readFileSync(join(process.cwd(), "src/briques/bibliotheque-video/moteur.ts"), "utf8");
  const imports = [...src.matchAll(/^\s*(?:import|export)[^;]*?from\s+["']([^"']+)["']/gm)].map((m) => m[1]);
  it("moteur.ts n'importe ni services, ni studio-rendu, ni argent, ni vitest, ni server-only", () => {
    expect(imports.length).toBeGreaterThan(0);
    for (const i of imports) {
      expect(i).not.toMatch(/@\/services\/|studio-rendu|credits|budget|couts|mode-budget|vitest|server-only/);
    }
  });
  it("aucun fichier de studio-rendu/ n'importe bibliotheque-video", () => {
    const hits: string[] = [];
    const parcourir = (d: string) => {
      for (const n of readdirSync(d)) {
        if (n === "node_modules" || n === ".git") continue;
        const p = join(d, n);
        const s = statSync(p);
        if (s.isDirectory()) parcourir(p);
        else if (/\.(ts|tsx|js|mjs)$/.test(n) && readFileSync(p, "utf8").includes("bibliotheque-video")) hits.push(p);
      }
    };
    parcourir(join(process.cwd(), "studio-rendu"));
    expect(hits).toEqual([]);
  });
});
