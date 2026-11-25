/**
 * N-11 : contrôle de contraste (4,5 pour 1) et de police (Manrope) des pièces neuves.
 * Les fiches de pièces neuves (C6, C9, C10, C8) appelleront `controlerPieceNeuve` dans LEUR test.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { PALETTE } from "../../../src/briques/charte/axion-2026";
import {
  CONTRASTE_TEXTE_MIN,
  POLICE_PIECE_NEUVE,
  POLICE_V4,
  controlerPieceNeuve,
} from "../../../src/briques/habillage/controle-piece-neuve";

describe("controlerPieceNeuve", () => {
  it("constantes", () => {
    expect(CONTRASTE_TEXTE_MIN).toBe(4.5);
    expect(POLICE_PIECE_NEUVE).toBe("Manrope");
    expect(POLICE_V4).toBe("Manrope"); // POLICES-P7-f (25/11, seconde lecture du pilote) : était « Montserrat »
  });

  it("noir sur ivoire est conforme", () => {
    expect(controlerPieceNeuve({ id: "x", textes: [{ couleur: PALETTE.noir, fond: PALETTE.ivoire }] })).toEqual([]);
  });

  it("une paire à 3:1 est refusée avec un message lisible", () => {
    const e = controlerPieceNeuve({ id: "p1", textes: [{ couleur: "#949494", fond: "#FFFFFF" }] });
    expect(e).toHaveLength(1);
    expect(e[0]).toMatch(/^p1 : contraste 3,\d pour 1 entre #949494 et #FFFFFF, minimum 4,5$/);
  });

  it("police : Montserrat refusée, Manrope ExtraBold acceptée, absente acceptée", () => {
    const t = [{ couleur: PALETTE.noir, fond: PALETTE.ivoire }];
    expect(controlerPieceNeuve({ id: "p", textes: t, police: "Montserrat" })).toHaveLength(1);
    expect(controlerPieceNeuve({ id: "p", textes: t, police: "Manrope ExtraBold" })).toEqual([]);
    expect(controlerPieceNeuve({ id: "p", textes: t })).toEqual([]);
  });

  it("rgba refusée poliment, couleur illisible sans exception", () => {
    const e = controlerPieceNeuve({ id: "p", textes: [{ couleur: "rgba(0,0,0,0.5)", fond: "#FFFFFF" }, { couleur: "zzz", fond: "#FFF" }] });
    expect(e).toHaveLength(2);
    expect(e[0]).toContain("couleur opaque attendue");
  });

  // POLICES-P7-f (25/11, seconde lecture du pilote) : était « déclarent Montserrat et jamais Manrope ». Les noms d'aides
  // (`styleMontserrat`, `MONTSERRAT`) et les scripts de rendu `.mjs` (0 ligne) gardent le mot : seules les DÉCLARATIONS comptent.
  it("test d'égalité v4 : les plaquettes v4 déclarent Manrope et jamais Montserrat", () => {
    const racine = fileURLToPath(new URL("../../../studio-rendu/compositions/interface-claire/motion-v4/", import.meta.url));
    const lister = (d: string): string[] =>
      readdirSync(d).flatMap((n) => {
        const c = join(d, n);
        return statSync(c).isDirectory() ? lister(c) : /\.(tsx?|mjs)$/.test(n) ? [c] : [];
      });
    const fichiers = lister(racine);
    expect(fichiers.length).toBeGreaterThan(0);
    const texte = fichiers.map((f) => readFileSync(f, "utf8")).join("\n");
    expect(texte).toContain(POLICE_V4);
    const declarations = fichiers
      .filter((f) => /\.tsx?$/.test(f))
      .flatMap((f) => (readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1").match(/(["'`])(?:(?!\1)[^\n\\]|\\.)*\1/g) ?? []).map((l) => `${f} ${l}`));
    expect(declarations.filter((l) => /Montserrat/.test(l.split(" ").slice(1).join(" ")))).toEqual([]);
    expect(POLICE_V4).toBe(POLICE_PIECE_NEUVE);
  });
});
