/** C8-L06 : dessin de la pastille « logo + nom d'outil » (pièce neuve, éteinte). Formes neutres seulement, aucun vrai logo. */
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

let frameCourante = 25;
vi.mock("remotion", () => ({
  useCurrentFrame: () => frameCourante,
  useVideoConfig: () => ({ width: 1080, height: 1920, fps: 25 }),
  delayRender: () => 1,
  continueRender: () => undefined,
}));

import { geometriePastilleLogo, type DemandePastilleLogo } from "@/briques/sous-titres/pastille-logo";
import { NOMS_OUTILS } from "@/briques/sous-titres/noms-outils";
import type { DessinLogo } from "@/briques/motion/logos-outils/types";

const CHEMIN = "../../../studio-rendu/compositions/sous-titres/PastilleLogo";
const FICHIER = "studio-rendu/compositions/sous-titres/PastilleLogo.tsx";
const TABLE: Record<string, DessinLogo> = { "essai-carre": { vue: [0, 0, 24, 24], noeuds: [["path", { d: "M0 0H24V24H0Z" }]] } };
const outil = NOMS_OUTILS[0]!;
const base: DemandePastilleLogo = { variante: "autonome", outilId: outil.id, logoId: "essai-carre", largeurImage: 1080, hauteurImage: 1920, tailleTextePx: 64 };

type Props = { geometrie: ReturnType<typeof geometriePastilleLogo>; debutSec: number; finSec: number };
async function rendre(p: Props): Promise<string> {
  const { PastilleLogo } = (await import(/* @vite-ignore */ CHEMIN)) as { PastilleLogo: (p: Props) => ReturnType<typeof createElement> | null };
  return renderToStaticMarkup(createElement(PastilleLogo, p));
}

describe("PastilleLogo (dessin)", () => {
  it("(a) géométrie nulle ou pastille invisible : rien", async () => {
    expect(await rendre({ geometrie: null, debutSec: 0, finSec: 5 })).toBe("");
    frameCourante = 0;
    expect(await rendre({ geometrie: geometriePastilleLogo(base, TABLE), debutSec: 2, finSec: 5 })).toBe("");
    frameCourante = 25;
  });

  it("(b) avec logo : un <svg> de <path> au viewBox de la vue, sans transform, ombre ni contour sur le logo, et le nom", async () => {
    const g = geometriePastilleLogo(base, TABLE)!;
    expect(g.avecLogo).toBe(true);
    const html = await rendre({ geometrie: g, debutSec: 0, finSec: 5 });
    expect(html).toContain('viewBox="0 0 24 24"');
    expect(html).toContain('<path d="M0 0H24V24H0Z"');
    expect(html).toContain(g.nom);
    const svg = html.slice(html.indexOf("<svg"), html.indexOf("</svg>"));
    expect(svg).not.toMatch(/transform|filter|stroke|shadow|rotate/);
    expect(svg).not.toContain("<image");
  });

  it("(c) repli texte seul : aucun <svg>, le nom reste écrit", async () => {
    const g = geometriePastilleLogo({ ...base, logoId: "absent" }, TABLE)!;
    expect(g.avecLogo).toBe(false);
    const html = await rendre({ geometrie: g, debutSec: 0, finSec: 5 });
    expect(html).not.toContain("<svg");
    expect(html).toContain(g.nom);
  });

  it("(d) garde du fichier : pas de réseau, d'image, de hex, d'alias d'application ni de constante d'allumage", () => {
    const src = readFileSync(FICHIER, "utf8");
    expect(src).not.toMatch(/fetch\(|<img|<Img|#[0-9a-fA-F]{3,8}\b|from "@\/|ACTIF|<Audio|<Video/);
    expect(src).not.toMatch(/logos-outils\/(index|manifeste)|droits/);
  });
});
