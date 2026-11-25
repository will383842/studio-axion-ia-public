/**
 * PLANCHE-C11-T4-v21s : outil local qui capture la planche « apparition au mot » en vraie police Manrope.
 * Parties pures seulement (aucun navigateur lancé). `outils/` hors tsc : chemin CALCULÉ + type local.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PlancheApparition } from "../../outils/planche-apparition/PlancheApparition";
import { APPARITION_ACTIVE } from "../../src/briques/sous-titres/apparition";

const RACINE = resolve(__dirname, "../..");
const CHEMIN = ["..", "..", "outils", "planche-apparition-images", "images.mts"].join("/");
type Module = {
  lireArguments: (a: string[]) => { navigateur?: string; sortie: string };
  pageHtml: (fond: "ivoire" | "noir", cheminPolice: string) => string;
  argumentsNavigateur: (html: string, png: string) => string[];
};
const mod = (await import(/* @vite-ignore */ CHEMIN)) as Module;
const POLICE = join(RACINE, "src/briques/sous-titres/polices/Manrope-Variable.ttf");
const SOURCE = readFileSync(join(RACINE, "outils/planche-apparition-images/images.mts"), "utf8");

function fichiers(dossier: string): string[] {
  return readdirSync(join(RACINE, dossier)).flatMap((n) => {
    const c = `${dossier}/${n}`;
    if (n === "node_modules") return [];
    return statSync(join(RACINE, c)).isDirectory() ? fichiers(c) : [c];
  });
}

describe("PLANCHE-C11-T4-v21s", () => {
  it("(a) la page porte Manrope du dépôt", () => {
    const h = mod.pageHtml("ivoire", POLICE);
    expect(h).toContain("@font-face");
    expect(h).toContain("font-family:Manrope");
    const url = /url\("(file:\/\/[^"]+)"\)/.exec(h)?.[1] ?? "";
    expect(url.endsWith("Manrope-Variable.ttf")).toBe(true);
    expect(existsSync(POLICE)).toBe(true);
    expect(h).not.toMatch(/https?:/);
  });
  it("(b) le vrai composant, déterministe", () => {
    for (const fond of ["ivoire", "noir"] as const) {
      const corps = renderToStaticMarkup(React.createElement(PlancheApparition, { fond }));
      expect(mod.pageHtml(fond, POLICE)).toContain(corps);
      expect(mod.pageHtml(fond, POLICE)).toBe(mod.pageHtml(fond, POLICE));
    }
  });
  it("(c) arguments du navigateur", () => {
    const a = mod.argumentsNavigateur("/t/p.html", "/t/p.png");
    for (const x of ["--headless=new", "--window-size=1080,1920", "--screenshot=/t/p.png", "--hide-scrollbars", "--force-device-scale-factor=1"]) expect(a).toContain(x);
    expect(a.some((x) => x.startsWith("file://") && x.endsWith("p.html"))).toBe(true);
    expect(a.join(" ")).not.toMatch(/https?:/);
  });
  it("(d) arguments et gardes", () => {
    const vide = mod.lireArguments([]);
    expect(vide.navigateur).toBeUndefined();
    expect(vide.sortie.replace(/\\/g, "/").endsWith("captures/apparition")).toBe(true);
    expect(mod.lireArguments(["--sortie", "x", "--navigateur", "y"])).toMatchObject({ navigateur: "y" });
    expect(mod.lireArguments(["--navigateur", "y", "--sortie", "x"])).toMatchObject({ navigateur: "y" });
    expect(SOURCE).not.toMatch(/reglages|depots|process\.env|fetch\(|mention-ia|MentionIA|studio-rendu/);
    expect(SOURCE).toMatch(/finally\s*\{[^}]*rmSync/);
    expect(SOURCE).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });
  it("(e) rien n'importe l'outil, éteint", () => {
    expect(APPARITION_ACTIVE).toBe(false);
    for (const f of [...fichiers("src"), ...fichiers("studio-rendu")].filter((x) => /\.(tsx?|mts|json)$/.test(x))) {
      expect(readFileSync(join(RACINE, f), "utf8"), f).not.toMatch(/planche-apparition-images/);
    }
  });
});
