import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { DessinLogo } from "../../../src/briques/motion/logos-outils/types";
import { DESSINS_LOGOS } from "../../../src/briques/motion/logos-outils/dessins";

const RACINE = process.cwd();
// Chemin variable : `tsc` ne suit pas les `.mts` (pas d'allowImportingTsExtensions) ; vitest les charge sans souci.
const CONVERTIR = join(RACINE, "outils", "logos-outils", "convertir.mts");
const {
  PLAFOND_DESSINS_OCTETS,
  PLAFOND_LOGO_OCTETS,
  assainirSvg,
  genererDessins,
  lireFichiersLogos,
} = (await import(/* @vite-ignore */ CONVERTIR)) as {
  PLAFOND_DESSINS_OCTETS: number;
  PLAFOND_LOGO_OCTETS: number;
  assainirSvg: (t: string) => { dessin: DessinLogo } | { refus: string };
  genererDessins: (f: { id: string; texte: string }[]) => string;
  lireFichiersLogos: (d: string) => { id: string; texte: string }[];
};
const DOSSIER = join(RACINE, "src", "briques", "motion", "logos-outils");

const svg = (corps: string, attrs = `viewBox="0 0 24 24"`) => `<svg ${attrs}>${corps}</svg>`;
const refuse = (texte: string) => {
  const r = assainirSvg(texte);
  expect("refus" in r).toBe(true);
  if ("refus" in r) expect(r.refus.length).toBeGreaterThan(0);
};

describe("assainisseur SVG à liste blanche", () => {
  it("accepte un SVG sain (données exactes)", () => {
    expect(assainirSvg(svg(`<path d="M0 0L10 0 10 10z" fill="#1A2b3C"/><path d="M1.5,2e-1h3Z"/>`))).toEqual({
      dessin: {
        vue: [0, 0, 24, 24],
        noeuds: [
          ["path", { d: "M0 0L10 0 10 10z", fill: "#1A2b3C" }],
          ["path", { d: "M1.5,2e-1h3Z" }],
        ],
      },
    });
  });
  it("accepte xmlns, role et <path></path>", () => {
    const r = assainirSvg(`<svg role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 20"><path d="M0 0h1"></path></svg>`);
    expect(r).toEqual({ dessin: { vue: [0, 0, 10, 20], noeuds: [["path", { d: "M0 0h1" }]] } });
  });
  it("refuse <script>", () => refuse(svg(`<script>alert(1)</script><path d="M0 0"/>`)));
  it("refuse <style>", () => refuse(svg(`<style>a{}</style><path d="M0 0"/>`)));
  it("refuse <image>", () => refuse(svg(`<image width="1"/><path d="M0 0"/>`)));
  it("refuse <use>", () => refuse(svg(`<use/><path d="M0 0"/>`)));
  it("refuse href", () => refuse(svg(`<path d="M0 0" href="x"/>`)));
  it("refuse xlink:href", () => refuse(svg(`<path d="M0 0" xlink:href="x"/>`)));
  it("refuse on*=", () => refuse(svg(`<path d="M0 0" onload="x()"/>`)));
  it("refuse une entité", () => refuse(svg(`<path d="M0 0&#x41;"/>`)));
  it("refuse une entité nommée", () => refuse(svg(`<path d="M0 0" fill="#fff&amp;"/>`)));
  it("refuse transform", () => refuse(svg(`<path d="M0 0" transform="rotate(5)"/>`)));
  it("refuse fill url(", () => refuse(svg(`<path d="M0 0" fill="url(#a)"/>`)));
  it("refuse fill hors hex", () => refuse(svg(`<path d="M0 0" fill="red"/>`)));
  it("refuse d avec caractères hors tracé", () => refuse(svg(`<path d="M0 0 alert(1)"/>`)));
  it("refuse d vide ou sans M", () => {
    refuse(svg(`<path d=""/>`));
    refuse(svg(`<path d="L1 1"/>`));
  });
  it("refuse une autre balise (g, circle, title)", () => {
    refuse(svg(`<g><path d="M0 0"/></g>`));
    refuse(svg(`<circle r="1"/>`));
    refuse(svg(`<title>x</title><path d="M0 0"/>`));
  });
  it("refuse un attribut inconnu sur path ou svg", () => {
    refuse(svg(`<path d="M0 0" stroke="#000"/>`));
    refuse(svg(`<path d="M0 0"/>`, `viewBox="0 0 24 24" width="9"`));
  });
  it("refuse sans viewBox ou viewBox invalide", () => {
    refuse(`<svg><path d="M0 0"/></svg>`);
    refuse(svg(`<path d="M0 0"/>`, `viewBox="0 0 0 24"`));
    refuse(svg(`<path d="M0 0"/>`, `viewBox="a b c d"`));
  });
  it("refuse un SVG sans aucun tracé, un texte quelconque, un commentaire, une déclaration", () => {
    refuse(svg(``));
    refuse("bonjour");
    refuse(svg(`<!-- x --><path d="M0 0"/>`));
    refuse(`<?xml version="1.0"?>` + svg(`<path d="M0 0"/>`));
  });
  it("plafond 8 Ko par logo", () => {
    const ok = svg(`<path d="M${"1 ".repeat((PLAFOND_LOGO_OCTETS - 200) / 2)}"/>`);
    expect("dessin" in assainirSvg(ok)).toBe(true);
    refuse(svg(`<path d="M${"1 ".repeat(PLAFOND_LOGO_OCTETS / 2)}"/>`));
  });
  it("plafond 64 Ko pour tout dessins.ts", () => {
    const gros = svg(`<path d="M${"1 ".repeat(3500)}"/>`);
    const fichier = (id: string) => ({ id, texte: gros });
    const ok = Array.from({ length: 8 }, (_, i) => fichier(`logo-${i}`));
    expect(() => genererDessins(ok)).not.toThrow();
    const trop = Array.from({ length: 12 }, (_, i) => fichier(`logo-${i}`));
    expect(() => genererDessins(trop)).toThrow(/64 Ko/);
    expect(PLAFOND_DESSINS_OCTETS).toBe(64 * 1024);
  });
  it("génération : refus d'un fichier, id invalide, doublon", () => {
    expect(() => genererDessins([{ id: "a", texte: "<svg/>" }])).toThrow();
    expect(() => genererDessins([{ id: "A b", texte: svg(`<path d="M0 0"/>`) }])).toThrow();
  });
});

describe("identité fichiers ↔ données", () => {
  it("chaque fichiers/<id>.svg correspond à une clé de DESSINS_LOGOS, et inversement (vrai à vide)", () => {
    const dossier = join(DOSSIER, "fichiers");
    const ids = existsSync(dossier)
      ? readdirSync(dossier).filter((f) => f.endsWith(".svg")).map((f) => f.slice(0, -4)).sort()
      : [];
    expect(Object.keys(DESSINS_LOGOS).sort()).toEqual(ids);
  });
  it("dessins.ts est régénéré à l'identique par le script", () => {
    const attendu = genererDessins(lireFichiersLogos(join(DOSSIER, "fichiers")));
    expect(readFileSync(join(DOSSIER, "dessins.ts"), "utf8")).toBe(attendu);
  });
  it("dessins.ts est vide et sans alias @/", () => {
    expect(DESSINS_LOGOS).toEqual({});
    expect(readFileSync(join(DOSSIER, "dessins.ts"), "utf8")).not.toMatch(/@\//);
    expect(statSync(join(DOSSIER, "dessins.ts")).size).toBeLessThan(PLAFOND_DESSINS_OCTETS);
  });
  it("aucun dangerouslySetInnerHTML dans logos-outils", () => {
    const parcourir = (d: string): string[] =>
      readdirSync(d, { withFileTypes: true }).flatMap((e) =>
        e.isDirectory() ? parcourir(join(d, e.name)) : [join(d, e.name)],
      );
    for (const f of parcourir(DOSSIER)) {
      if (f.endsWith(".svg")) continue;
      expect(readFileSync(f, "utf8"), f).not.toMatch(/dangerouslySetInnerHTML/);
    }
  });
});
