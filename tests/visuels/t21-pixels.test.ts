/**
 * T21 (page sombre) mesurée sur les PIXELS du rendu réel (Remotion + Chromium), pas sur le texte source : aucune grande zone ronde
 * orange PLEINE (un disque sans rien dedans, posé pour décorer). Une bulle de message avec ses trois points DEDANS n'en est pas une.
 * Sans les dépendances de `studio-rendu` ni `STUDIO_RENDU_NAVIGATEUR`, le rendu est SAUTÉ ; le détecteur, lui, est toujours essayé.
 */
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { CHARTE_CARROUSEL } from "@/briques/visuels/charte-carrousel";
import type { ImageRgb } from "../../studio-rendu/scripts/analyse-image";

const MINUTES = 60_000;
const DISPONIBLE = existsSync(new URL("../../studio-rendu/node_modules/@remotion/renderer", import.meta.url)) && Boolean(process.env.STUDIO_RENDU_NAVIGATEUR);
/** Diamètre (px) à partir duquel un disque orange plein compte comme un « gros rond ». */
const DIAMETRE_MIN = 80;

const orange = [1, 3, 5].map((i) => parseInt(CHARTE_CARROUSEL.couleurs.orange.slice(i, i + 2), 16));

interface Disque {
  x: number;
  y: number;
  diametre: number;
}

/**
 * Grandes zones orange d'un seul tenant qui sont des DISQUES PLEINS : boîte presque carrée, surface égale à celle de l'ellipse inscrite
 * (à 7 % près), et l'ellipse intérieure (90 %) entièrement orange. Une bulle (coins presque droits, queue) dépasse l'ellipse ; des points
 * dedans la trouent : ni l'une ni l'autre n'est retenue.
 */
function disquesOrangePleins(image: ImageRgb, diametreMin = DIAMETRE_MIN): Disque[] {
  const { largeur, hauteur, rgb } = image;
  const masque = new Uint8Array(largeur * hauteur);
  for (let p = 0; p < largeur * hauteur; p++) if (orange.every((c, k) => Math.abs(rgb[p * 3 + k]! - c) <= 40)) masque[p] = 1;
  const vu = new Uint8Array(largeur * hauteur);
  const disques: Disque[] = [];
  const pile: number[] = [];
  for (let depart = 0; depart < masque.length; depart++) {
    if (!masque[depart] || vu[depart]) continue;
    let aire = 0;
    let [x0, y0, x1, y1] = [largeur, hauteur, -1, -1];
    pile.push(depart);
    vu[depart] = 1;
    while (pile.length) {
      const p = pile.pop()!;
      const x = p % largeur;
      const y = (p - x) / largeur;
      aire++;
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
      y0 = Math.min(y0, y);
      y1 = Math.max(y1, y);
      for (const q of [x > 0 ? p - 1 : -1, x < largeur - 1 ? p + 1 : -1, p - largeur, p + largeur]) {
        if (q >= 0 && q < masque.length && masque[q] && !vu[q]) {
          vu[q] = 1;
          pile.push(q);
        }
      }
    }
    const l = x1 - x0 + 1;
    const h = y1 - y0 + 1;
    if (Math.min(l, h) < diametreMin || l / h < 0.85 || l / h > 1.18) continue;
    const ellipse = (Math.PI / 4) * l * h;
    if (aire < 0.93 * ellipse || aire > 1.07 * ellipse) continue;
    const [cx, cy, rx, ry] = [(x0 + x1) / 2, (y0 + y1) / 2, (0.9 * l) / 2, (0.9 * h) / 2];
    let dedans = 0;
    let plein = 0;
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 > 1) continue;
        dedans++;
        if (masque[y * largeur + x]) plein++;
      }
    }
    if (plein >= 0.99 * dedans) disques.push({ x: Math.round(cx), y: Math.round(cy), diametre: Math.round((l + h) / 2) });
  }
  return disques;
}

/** Image d'essai sur fond encre : des disques orange pleins, et/ou une bulle orange aux trois points crème. */
function imageEssai(dessiner: (poser: (x: number, y: number, couleur: number[]) => void) => void): ImageRgb {
  const [largeur, hauteur] = [600, 400];
  const rgb = new Uint8Array(largeur * hauteur * 3);
  const poser = (x: number, y: number, c: number[]) => rgb.set(c, (y * largeur + x) * 3);
  dessiner(poser);
  return { largeur, hauteur, rgb } as ImageRgb;
}
const disque = (poser: (x: number, y: number, c: number[]) => void, cx: number, cy: number, r: number, c: number[]) => {
  for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) poser(x, y, c);
};

describe("détecteur de gros ronds orange pleins", () => {
  it("trois disques orange pleins côte à côte : trois trouvés", () => {
    const image = imageEssai((poser) => [100, 300, 500].forEach((cx) => disque(poser, cx, 200, 70, orange)));
    expect(disquesOrangePleins(image)).toHaveLength(3);
  });
  it("une bulle orange (rectangle arrondi) aux trois points crème dedans : aucun disque", () => {
    const image = imageEssai((poser) => {
      for (let y = 60; y < 340; y++) for (let x = 60; x < 540; x++) poser(x, y, orange);
      [180, 300, 420].forEach((cx) => disque(poser, cx, 200, 22, [248, 240, 227]));
    });
    expect(disquesOrangePleins(image)).toEqual([]);
  });
  it("un petit point orange (sous le diamètre minimal) n'est pas un gros rond", () => {
    expect(disquesOrangePleins(imageEssai((poser) => disque(poser, 300, 200, 20, orange)))).toEqual([]);
  });
});

describe.skipIf(!DISPONIBLE)("T21 rendue : aucun gros rond orange plein sous le titre", () => {
  // Titres de couverture ordinaires : à eux tous, ils font rendre chaque variante de la page sombre.
  const TITRES = ["Répondre plus vite aux demandes", "Ranger les dossiers du cabinet", "Préparer un devis sans stress", "Relancer sans gêner", "Trois réflexes pour vos devis", "Une semaine mieux rangée"];
  let rendre: (titre: string) => Promise<ImageRgb>;
  let VARIANTES_T21: readonly string[];
  let varianteT21: (titre: string) => string;
  beforeAll(async () => {
    // Chargée ici : la composition importe remotion, absent sans les dépendances de studio-rendu (le détecteur, lui, est toujours essayé).
    const t21 = await import("../../studio-rendu/compositions/visuels/pages/T21");
    VARIANTES_T21 = t21.VARIANTES_T21;
    varianteT21 = (titre) => t21.varianteFin({ version: "carrousel/1", alt: "Essai", pages: [{ type: "T01", titre }, { type: "T21" }] });
    const { ouvrirRendeur } = await import("../../studio-rendu/scripts/rendu-visuel");
    const { decoderPng } = await import("../../studio-rendu/scripts/analyse-image");
    const rendeur = await ouvrirRendeur();
    rendre = async (titre) => {
      const sortie = resolve(mkdtempSync(resolve(tmpdir(), "t21-pixels-")), "page.png");
      await rendeur.page({ version: "carrousel/1", alt: "Essai", pages: [{ type: "T01", titre }, { type: "T21" }] }, 1, sortie, "png");
      return decoderPng(readFileSync(sortie));
    };
  }, 5 * MINUTES);

  it("les titres d'essai couvrent toutes les variantes", () => {
    expect(new Set(TITRES.map(varianteT21))).toEqual(new Set(VARIANTES_T21));
  });

  it.each(TITRES)("« %s » : 0 disque orange plein", async (titre) => {
    expect(disquesOrangePleins(await rendre(titre)), `variante ${varianteT21(titre)}`).toEqual([]);
  }, 5 * MINUTES);
});
