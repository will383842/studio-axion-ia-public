/** C11-T8b-a : composant TexteEffets (9 effets), monté nulle part. */
import React from "react";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, describe, expect, it, vi } from "vitest";
vi.mock("remotion", () => ({ delayRender: () => 0, continueRender: () => undefined, cancelRender: () => undefined }));
import { EFFETS_TEXTE, type EffetTexte } from "@/briques/motion/texte-effets/effets";
import { PALETTE } from "@/briques/charte/axion-2026";

type Props = { texte: string; effet: EffetTexte; image: number; ips: number; options?: Record<string, unknown>; motNouveau?: string };
let TexteEffets: React.FC<Props>;
beforeAll(async () => {
  const chemin = ["..", "..", "..", "studio-rendu", "compositions", "commune", "texte-effets", "TexteEffets"].join("/");
  ({ TexteEffets } = (await import(/* @vite-ignore */ chemin)) as { TexteEffets: React.FC<Props> });
});

const IPS = 30;
const TARD = 60;
const rendre = (effet: string, image: number, extra: Partial<Props> = {}) =>
  renderToStaticMarkup(<TexteEffets texte="Bonjour" effet={effet as EffetTexte} image={image} ips={IPS} motNouveau="Salut" {...extra} />);

describe("TexteEffets : 9 effets", () => {
  it("la liste reste fermée à 9 effets", () => expect(EFFETS_TEXTE).toHaveLength(9));

  it("chacun des 9 effets produit un balisage à l'image 0 et tardive", () => {
    for (const e of EFFETS_TEXTE) {
      expect(rendre(e, 0)).toContain(`data-texte-effet="${e}"`);
      expect(rendre(e, TARD)).toContain(`data-texte-effet="${e}"`);
    }
  });

  it("flou-mot : blur(6px) puis blur(0px), sur le span du mot", () => {
    expect(rendre("flou-mot", 0)).toContain("filter:blur(6px)");
    expect(rendre("flou-mot", TARD)).toContain("filter:blur(0px)");
  });
  it("noir-blanc-mot : grayscale(1) puis grayscale(0)", () => {
    expect(rendre("noir-blanc-mot", 0)).toContain("filter:grayscale(1)");
    expect(rendre("noir-blanc-mot", TARD)).toContain("filter:grayscale(0)");
  });
  it("degrade-balaye : deux calques, départ puis arrivée rognée de gauche à droite, sans gradient CSS", () => {
    const fin = rendre("degrade-balaye", TARD);
    expect(fin).toContain(`color:${PALETTE.terracotta}`);
    expect(fin).toContain(`color:${PALETTE.ivoire}`);
    expect(fin).toContain("clip-path:inset(0 0% 0 0)");
    expect(fin).not.toContain("gradient");
    expect(rendre("degrade-balaye", 0)).toContain("clip-path:inset(0 100% 0 0)");
  });
  it("retrogradation : barré puis nouveau mot ; sans motNouveau → lève", () => {
    const a = rendre("retrogradation", 0);
    expect(a).toContain("line-through");
    expect(a).toContain(">Bonjour<");
    const n = rendre("retrogradation", TARD);
    expect(n).toContain(">Salut<");
    expect(n).not.toContain("line-through");
    expect(() => rendre("retrogradation", 0, { motNouveau: undefined })).toThrow();
  });
  it("aparte-fantome : opacité 0 puis 0.35 au plus", () => {
    expect(rendre("aparte-fantome", 0)).toContain("opacity:0");
    expect(rendre("aparte-fantome", TARD)).toContain("opacity:0.35");
  });
  it("titre-survit : opacité 1 puis 0 après 0,3 s", () => {
    expect(rendre("titre-survit", 0)).toContain("opacity:1");
    expect(rendre("titre-survit", Math.round(0.3 * IPS) + 1)).toContain("opacity:0");
  });
  it("interlettrage-serre : 0.2em puis 0em", () => {
    expect(rendre("interlettrage-serre", 0)).toContain("letter-spacing:0.2em");
    expect(rendre("interlettrage-serre", TARD)).toContain("letter-spacing:0em");
  });
  it("intonation : graisses 300 puis 800, jamais italic", () => {
    expect(rendre("intonation", 0)).toContain("font-weight:300");
    expect(rendre("intonation", TARD)).toContain("font-weight:800");
    expect(rendre("intonation", TARD)).not.toContain("italic");
  });
  it("contour-marque : contour 0 puis 2px orange", () => {
    expect(rendre("contour-marque", 0)).toContain("-webkit-text-stroke:0px");
    expect(rendre("contour-marque", TARD)).toContain(`-webkit-text-stroke:2px ${PALETTE.orange}`);
  });

  it("effet hors liste → lève", () => {
    expect(() => rendre("meme", 0)).toThrow();
    expect(() => rendre("legende-native", 0)).toThrow();
  });

  it("couleurs dans PALETTE, police Axion Manrope seulement", () => {
    const permises = Object.values(PALETTE).map((c) => c.toUpperCase());
    for (const e of EFFETS_TEXTE) {
      const h = rendre(e, TARD);
      for (const c of h.match(/#[0-9a-fA-F]{6}/g) ?? []) expect(permises).toContain(c.toUpperCase());
      for (const f of h.match(/font-family:[^;"]*/g) ?? []) expect(f).toContain("Axion Manrope");
    }
  });

  it("même entrée = même balisage", () => {
    for (const e of EFFETS_TEXTE) expect(rendre(e, 7)).toBe(rendre(e, 7));
  });
});

describe("gardes statiques C11-T8b-a", () => {
  const marche = (d: string): string[] =>
    !existsSync(d)
      ? []
      : readdirSync(d).flatMap((n) => {
          if (n === "node_modules" || n === ".next" || n === "out") return [];
          const c = join(d, n);
          return statSync(c).isDirectory() ? marche(c) : /\.(ts|tsx|js|mjs)$/.test(n) ? [c] : [];
        });
  const fichier = join(process.cwd(), "studio-rendu/compositions/commune/texte-effets/TexteEffets.tsx");
  it("rien n'importe TexteEffets", () => {
    const fautes = ["src", "studio-rendu/src", "studio-rendu/compositions"]
      .flatMap((r) => marche(join(process.cwd(), r)))
      .filter((f) => f !== fichier)
      .filter((f) => /TexteEffets/.test(readFileSync(f, "utf8")));
    expect(fautes).toEqual([]);
  });
  it("le composant n'importe ni services, ni fournisseurs, ni useCurrentFrame", () => {
    const s = readFileSync(fichier, "utf8");
    expect(s).not.toMatch(/@\/services|@\/fournisseurs|useCurrentFrame/);
  });
});
