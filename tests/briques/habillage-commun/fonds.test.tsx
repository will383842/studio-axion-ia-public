import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import {
  DESCRIPTION_FONDS,
  DESCRIPTION_FONDS_PAR_FOND,
  FondVivant,
  IDS_FONDS_VIVANTS,
  type IdFondVivant,
} from "../../../src/briques/motion/habillage-commun/fonds";
import { CHARTE_AXION, TEINTES_INTERDITES, couleursSur, type FondAxion } from "../../../src/briques/jetons-motion";
import { luminance } from "../../../src/briques/habillage/contraste";
import { controlerPieceNeuve } from "../../../src/briques/habillage/controle-piece-neuve";
import { Y_ST_MAX } from "../../../studio-rendu/compositions/interface-claire/motion-v4/communs/zone-sure-v4";

const FPS = 25;
const L = 1080;
const H = 1920;
const FONDS: FondAxion[] = ["ivoire", "noir"];
const rendre = (id: IdFondVivant, image: number, fond: FondAxion = "ivoire", graine = 7) =>
  renderToStaticMarkup(<FondVivant id={id} image={image} fps={FPS} largeur={L} hauteur={H} fond={fond} graine={graine} />);
const hexDe = (nom: keyof typeof CHARTE_AXION) => CHARTE_AXION[nom];
const rvb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const melange = (base: string, c: string, a: number) =>
  "#" + rvb(base).map((v, i) => Math.round(v * (1 - a) + rvb(c)[i] * a).toString(16).padStart(2, "0")).join("");
const dep = (html: string): number[][] =>
  (/data-dep="([^"]+)"/.exec(html)?.[1] ?? "").split(";").filter(Boolean).map((p) => p.split(",").map(Number));

describe("fonds vivants purs", () => {
  it("7 identifiants exacts et uniques", () => {
    expect([...IDS_FONDS_VIVANTS].sort()).toEqual(
      ["bande-diagonale", "double-lueur", "grain-papier", "grille-perspective", "lueur-derive", "points", "quadrillage"],
    );
    expect(new Set(IDS_FONDS_VIVANTS).size).toBe(7);
    expect(Object.keys(DESCRIPTION_FONDS).sort()).toEqual([...IDS_FONDS_VIVANTS].sort());
  });

  it("déterminisme : même entrée = même balisage ; images 0, 25, 100 différentes pour les fonds animés", () => {
    for (const id of IDS_FONDS_VIVANTS) {
      expect(rendre(id, 25)).toBe(rendre(id, 25));
      const a = [0, 25, 100].map((i) => rendre(id, i));
      expect(new Set(a).size, id).toBe(3);
    }
  });

  it("vitesse : ≤ vitesseMaxPctParSec ≤ 2 % de l'écran par seconde", () => {
    for (const id of IDS_FONDS_VIVANTS) {
      const max = DESCRIPTION_FONDS[id].vitesseMaxPctParSec;
      expect(max).toBeLessThanOrEqual(2);
      if (id === "grain-papier") continue;
      let vu = 0;
      for (let n = 0; n <= 200; n += 5) {
        const a = dep(rendre(id, n));
        const b = dep(rendre(id, n + FPS));
        a.forEach((p, k) => p.forEach((v, j) => (vu = Math.max(vu, Math.abs(b[k][j] - v)))));
      }
      expect(vu, id).toBeLessThanOrEqual(max + 0.011);
    }
  });

  it("grille-perspective : une case en 4 s (± 1 image)", () => {
    const lire = (n: number) => Number(/data-decalage-px="([^"]+)"/.exec(rendre("grille-perspective", n))![1]);
    const pas = Number(/data-pas-px="([^"]+)"/.exec(rendre("grille-perspective", 0))![1]);
    const un = pas / (4 * FPS);
    expect(Math.abs(lire(100) - lire(0) - pas)).toBeLessThanOrEqual(un + 0.01);
  });

  it("couleurs : seulement la charte, orange absent sur ivoire, aucune teinte interdite", () => {
    const permis = new Set(Object.values(CHARTE_AXION).map((h) => rvb(h).join(",")));
    for (const id of IDS_FONDS_VIVANTS) {
      for (const fond of FONDS) {
        for (const n of [0, 40]) {
          const html = rendre(id, n, fond);
          for (const m of html.matchAll(/rgba\((\d+), (\d+), (\d+)/g)) {
            const c = `${m[1]},${m[2]},${m[3]}`;
            if (c === "0,0,0") continue; // masque de perspective (alpha seul), comme noyau.tsx
            expect(permis.has(c), `${id} ${fond} ${c}`).toBe(true);
          }
          for (const m of html.matchAll(/#[0-9a-f]{6}/gi)) expect(Object.values(CHARTE_AXION)).toContain(m[0].toUpperCase());
          if (fond === "ivoire") expect(html).not.toContain(rvb(hexDe("orange")).join(", "));
          for (const mot of TEINTES_INTERDITES) expect(html.toLowerCase()).not.toContain(mot);
        }
      }
    }
  });

  it("contraste : écart ≤ 6 % de luminance, partout puis sous la bande des sous-titres", () => {
    expect(Y_ST_MAX).toBeLessThan(0.63 + 0.1);
    for (const id of IDS_FONDS_VIVANTS) {
      for (const fond of FONDS) {
        const base = couleursSur(fond).fond;
        const d = DESCRIPTION_FONDS_PAR_FOND[fond][id];
        for (const couches of [d.couleurs, d.couleursBandeBasse]) {
          for (const c of couches) {
            const ecart = Math.abs(luminance(melange(base, c.hex, c.opaciteMax)) - luminance(base));
            expect(ecart, `${id} ${fond}`).toBeLessThanOrEqual(0.06);
          }
        }
      }
    }
  });

  it("N-11 : contrôle de pièce neuve sans erreur pour 7 fonds × 2 fonds", () => {
    for (const id of IDS_FONDS_VIVANTS) {
      for (const fond of FONDS) {
        const base = couleursSur(fond).fond;
        const pire = DESCRIPTION_FONDS_PAR_FOND[fond][id].couleurs
          .map((c) => melange(base, c.hex, c.opaciteMax))
          .sort((a, b) => Math.abs(luminance(b) - luminance(base)) - Math.abs(luminance(a) - luminance(base)))[0];
        expect(controlerPieceNeuve({ id, textes: [{ couleur: couleursSur(fond).texte, fond: pire }] })).toEqual([]);
      }
    }
  });

  it("grain-papier : l'opacité dessinée (flood-color) = opaciteMax, alpha de matrice borné à 1", () => {
    for (const fond of FONDS) {
      const html = rendre("grain-papier", 3, fond);
      const a = Number(/flood-color="rgba\([^)]*?, ([\d.]+)\)"/.exec(html)![1]);
      expect(a).toBeCloseTo(DESCRIPTION_FONDS_PAR_FOND[fond]["grain-papier"].couleurs[0].opaciteMax, 3);
      const m = /values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 ([\d.]+) (-?[\d.]+)"/.exec(html)!;
      expect(Number(m[1]) + Number(m[2])).toBeLessThanOrEqual(1.2); // pente ; l'alpha final est écrêté à 1 par SVG
    }
  });

  it("grille-perspective : le balayage est dans data-dep (≤ 2 %/s, sans saut) ; bande-diagonale sans saut au repli", () => {
    expect(dep(rendre("grille-perspective", 0))).toHaveLength(2);
    const pasPx = 0.14 * L;
    const pos = (n: number) => Number(/background-position:([\d.]+)px/.exec(rendre("bande-diagonale", n))![1]);
    expect(pos(0)).toBeLessThan(pasPx);
    // au repli, la position retombe de ~pas vers 0 : multiple exact de la case, donc continu visuellement
    let n = 0;
    while (pos(n + 1) >= pos(n) && n < 5000) n++;
    expect(Math.abs(pos(n) - pasPx)).toBeLessThan(1);
  });

  it("grain-papier seul attend la mesure et refuse le grain FFmpeg", () => {
    for (const id of IDS_FONDS_VIVANTS) {
      expect(DESCRIPTION_FONDS[id].attendMesure).toBe(id === "grain-papier");
      expect(DESCRIPTION_FONDS[id].incompatibleGrainFfmpeg).toBe(id === "grain-papier");
    }
    expect(rendre("grain-papier", 4)).toContain('seed="9"'); // graine 7 + ⌊4 / 2⌋
  });

  it("id SVG suffixés par la graine", () => {
    expect(rendre("points", 0, "ivoire", 3)).toContain('id="points-3"');
    expect(rendre("grain-papier", 0, "ivoire", 3)).toContain('id="grain-3"');
  });

  it("source : aucun @/, Math.random, hook ni Remotion", () => {
    const src = readFileSync(join(__dirname, "../../../src/briques/motion/habillage-commun/fonds.tsx"), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    expect(src).not.toMatch(/@\/|Math\.random|useCurrentFrame|from "remotion"|\buse[A-Z]\w*\(|blur/);
  });
});
