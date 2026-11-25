/**
 * PLANCHE-C9-42-v21s : outil local qui re-rend la planche des 4 petits objets du cas concret (aucun rendu Remotion ici).
 * L'outil est chargé par chemin CALCULÉ (le tsc racine ne doit pas suivre `studio-rendu/**`), avec un type local.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { LIGNES_OBJETS } from "@/briques/bibliotheque-video/catalogue/objets";

const RACINE = resolve(__dirname, "..", "..");
const CHEMIN_OUTIL = [RACINE, "outils", "planche-objets-cas-concret", "planche.mts"].join("/");
const CHEMIN_TEMOIN = [RACINE, "studio-rendu", "scripts", "temoin-objets-cas-concret.ts"].join("/");
const SOURCE = readFileSync(CHEMIN_OUTIL, "utf8");

interface Image { fichier: string; variante: "sans" | "avec"; texte: number; scene: number; piece: string; image: number }
interface Outil {
  lireArguments: (a: string[]) => { navigateur: string | undefined; sortie: string };
  imagesPlanche: (p: unknown[]) => Promise<Image[]>;
  rapportPlanche: (i: Image[]) => Promise<string>;
}
interface Temoin {
  lesPaires: () => Promise<unknown[]>;
  imagesDe: (p: unknown[]) => Image[];
  OBJETS_TEMOIN: readonly string[];
}
const outil = async (): Promise<Outil> => (await import(/* @vite-ignore */ CHEMIN_OUTIL)) as Outil;
const temoin = async (): Promise<Temoin> => (await import(/* @vite-ignore */ CHEMIN_TEMOIN)) as Temoin;

function fichiers(dossier: string): string[] {
  return readdirSync(dossier).flatMap((n) => {
    const c = join(dossier, n);
    return statSync(c).isDirectory() ? fichiers(c) : [c];
  });
}

describe("PLANCHE-C9-42-v21s · planche des petits objets du cas concret", () => {
  it("(a) arguments : pas de navigateur par défaut, sortie par défaut, deux ordres", async () => {
    const { lireArguments } = await outil();
    const d = lireArguments([]);
    expect(d.navigateur).toBeUndefined();
    expect(d.sortie.endsWith(join("captures", "objets-cas-concret"))).toBe(true);
    const un = lireArguments(["--navigateur", "x", "--sortie", "y"]);
    const deux = lireArguments(["--sortie", "y", "--navigateur", "x"]);
    expect(un.navigateur).toBe("x");
    expect(un.sortie).toBe(resolve("y"));
    expect(deux).toEqual(un);
  });

  it("(b) images du témoin : mêmes noms, sans et avec, les 4 objets, sans doublon, déterministe", async () => {
    const { imagesPlanche } = await outil();
    const t = await temoin();
    const paires = await t.lesPaires();
    const images = await imagesPlanche(paires);
    expect(images).toEqual(t.imagesDe(paires));
    expect(images.some((i) => i.variante === "sans")).toBe(true);
    expect(images.some((i) => i.variante === "avec")).toBe(true);
    const pieces = new Set(images.filter((i) => i.variante === "avec").map((i) => i.piece));
    for (const o of t.OBJETS_TEMOIN) expect(pieces.has(o), o).toBe(true);
    const noms = images.map((i) => i.fichier);
    expect(new Set(noms).size).toBe(noms.length);
    expect(await imagesPlanche(await t.lesPaires())).toEqual(images);
  });

  it("(c) rapport : une ligne par image et la ligne « objets montrés : » avec les 4 objets", async () => {
    const { imagesPlanche, rapportPlanche } = await outil();
    const t = await temoin();
    const images = await imagesPlanche(await t.lesPaires());
    const lignes = (await rapportPlanche(images)).split("\n");
    expect(lignes).toHaveLength(images.length + 1);
    const derniere = lignes[lignes.length - 1]!;
    expect(derniere.startsWith("objets montrés : ")).toBe(true);
    for (const o of t.OBJETS_TEMOIN) expect(derniere).toContain(o);
    images.forEach((i, k) => expect(lignes[k]).toContain(i.fichier));
  });

  it("(d) gardes de l'outil : rien d'interdit, navigateur passé aux deux appels, dossier de sortie, aucune écriture sous studio-rendu", () => {
    expect(SOURCE).not.toMatch(/reglages|depots|process\.env|fetch\(|mention-ia|MentionIA|ensureBrowser/);
    expect(SOURCE).not.toMatch(/from ["'][^"']*studio-rendu/);
    expect(SOURCE.match(/browserExecutable: navigateur/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
    expect(SOURCE).toContain('"captures", "objets-cas-concret"');
    expect(SOURCE).not.toMatch(/writeFileSync\([^)]*studio-rendu/);
  });

  it("(e) rien n'importe l'outil, rien n'est allumé", () => {
    const citeurs = [...fichiers(join(RACINE, "src")), ...fichiers(join(RACINE, "studio-rendu", "compositions")), ...fichiers(join(RACINE, "studio-rendu", "scripts"))].filter(
      (f) => /\.(ts|tsx|mts)$/.test(f) && readFileSync(f, "utf8").includes("planche-objets-cas-concret"),
    );
    expect(citeurs).toEqual([]);
    expect(LIGNES_OBJETS.every((l) => l.etat === "prevu")).toBe(true);
  });
});
