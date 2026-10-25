/**
 * Relecture finale IV (v-6e4a06b9c718, 52,4 s, cause E) : le bandeau en objets (CHI-E) ne dessinait que « 80% », jamais sa
 * légende « résolus instantanément ». Règle commune des 4 variantes (anneau, duel, géant, objets) : la légende du chiffre
 * principal est DESSINÉE sous (ou près de) lui, à 62 px, et reste lisible (au moins 58 px à l'écran) une fois le chiffre
 * rapetissé (`echelle` < 1) : elle est contre-agrandie de 1 / échelle. Rendu en HTML statique (react-dom/server) : aucun
 * appel, aucun remotion. Les valeurs sont celles de la vidéo réelle (fixture `v-6e4a06b9c718-scene.json`).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Anneau, geometrieAnneau } from "../../studio-rendu/compositions/image-video/variete/chiffres/anneau";
import type { DonneesEcranChiffresRendu } from "../../studio-rendu/compositions/image-video/variete/chiffres/donnees";
import { Duel, planDuel } from "../../studio-rendu/compositions/image-video/variete/chiffres/duel";
import { Geant, planGeant } from "../../studio-rendu/compositions/image-video/variete/chiffres/geant";
import { Objets } from "../../studio-rendu/compositions/image-video/variete/chiffres/objets";
import { Pile } from "../../studio-rendu/compositions/image-video/variete/chiffres/pile";
import { largeurAnton } from "../../src/briques/schema-motion/chasse-anton";
import { largeurTexte } from "../../src/briques/ecrans-motion/mesure";
import { cadreChiffres, LEGENDE_MIN_PX, scinderChiffre } from "../../studio-rendu/compositions/image-video/variete/chiffres/outils";

const LEGENDE = "résolus instantanément";
const scene = JSON.parse(readFileSync(join(process.cwd(), "tests/image-video/fixtures/v-6e4a06b9c718-scene.json"), "utf8"));
const cadre = cadreChiffres(1920);

/** Les chiffres du bandeau de la vidéo réelle : « 80% résolus instantanément », « 0 demande perdue », « 24h/24 ». */
const base = (code: DonneesEcranChiffresRendu["code"], texteFocal = "80%"): DonneesEcranChiffresRendu => ({
  code,
  fond: code === "CHI-D" ? "sombre" : "ivoire",
  debut: 0,
  fin: 6,
  etiquette: "Résultat",
  chiffres: [
    { texte: texteFocal, legende: LEGENDE, t: 0.4 },
    { texte: "0 demande", legende: "perdue", t: 2 },
    { texte: "24h/24", t: 3.5 },
  ],
  focal: 0,
  finVariante: 6,
  icones: { entree: "message", sortie: "check" },
});
const donnees: Record<string, DonneesEcranChiffresRendu> = {
  "CHI-B": { ...base("CHI-B"), anneau: { valeur: 80, reste: { texte: "20%", legende: "Limite atteinte" } } },
  "CHI-C": { ...base("CHI-C", "3 secondes"), duel: { ancien: { texte: "23 min", legende: "Recherche", t: 0 } } },
  "CHI-D": { ...base("CHI-D", "24h/24"), geant: { lignes: ["24h", "/24"], legende: LEGENDE } },
  "CHI-E": { ...base("CHI-E"), objets: { total: 10, part: 8, reste: { texte: "20%" } } },
};
const variantes: Record<string, ComponentType<{ d: DonneesEcranChiffresRendu; t: number; t0: number; cadre: ReturnType<typeof cadreChiffres>; discret?: number; echelle?: number }>> = {
  "CHI-B": Anneau,
  "CHI-C": Duel,
  "CHI-D": Geant,
  "CHI-E": Objets,
};
const rendre = (code: string, echelle: number, discret = 0, d = donnees[code]) =>
  renderToStaticMarkup(createElement(variantes[code], { d, t: 5, t0: 0.4, cadre, echelle, discret }));
/** Style en ligne de la balise qui porte exactement la légende. */
const styleDeLegende = (html: string): string | undefined => new RegExp(`style="([^"]*)">${LEGENDE}</div>`, "u").exec(html)?.[1];
const taille = (style: string) => Number(/font-size:(\d+(?:\.\d+)?)px/.exec(style)![1]);
const contre = (style: string) => Number(/transform:scale\(([\d.]+)\)/.exec(style)?.[1] ?? "1");

describe("légende du chiffre principal · données de la vidéo réelle", () => {
  it("le bandeau de la carte porte « 80% résolus instantanément » : la légende du chiffre principal est « résolus instantanément »", () => {
    expect(scene.carte.bandeau[0]).toBe("80% résolus instantanément");
    expect(scene.carte.bandeau[0].replace("80%", "").trim()).toBe(LEGENDE);
  });
});

describe("légende du chiffre principal · CHI-E (objets) la dessine", () => {
  it("à l'échelle 1 : « résolus instantanément » est écrit, à 62 px, sous le chiffre (ROUGE avant le lot : jamais dessinée)", () => {
    const html = rendre("CHI-E", 1);
    expect(html).toContain(LEGENDE);
    const style = styleDeLegende(html)!;
    expect(style).toBeDefined();
    expect(taille(style)).toBe(62);
    expect(contre(style)).toBe(1);
    // Sous le chiffre de 350 px (haut 280 + décalage du cadre 130 - 300) : au moins aux deux tiers de sa hauteur.
    const top = Number(/top:(\d+(?:\.\d+)?)px/.exec(style)![1]);
    expect(top).toBeGreaterThan(280 + (cadre.haut - 300) + 350 * 0.8);
  });

  it("sans légende au chiffre, rien n'est écrit en plus (pas de texte inventé)", () => {
    const d = { ...donnees["CHI-E"], chiffres: donnees["CHI-E"].chiffres.map((c, i) => (i === 0 ? { texte: c.texte, t: c.t } : c)) };
    expect(rendre("CHI-E", 1, 0, d)).not.toContain(LEGENDE);
  });
});

describe("légende du chiffre principal · reste lisible une fois le chiffre rapetissé (4 variantes)", () => {
  for (const code of ["CHI-B", "CHI-C", "CHI-D", "CHI-E"]) {
    for (const echelle of [1, 0.85, 0.7, 0.66]) {
      it(`${code} · échelle ${echelle} : légende dessinée, ≥ ${LEGENDE_MIN_PX} px à l'écran, visible même quand le reste s'efface (discret 1)`, () => {
        const html = rendre(code, echelle, 1);
        expect(html).toContain(LEGENDE);
        const style = styleDeLegende(html)!;
        expect(style, "balise de la légende introuvable").toBeDefined();
        const aLEcran = taille(style) * contre(style) * echelle;
        expect(aLEcran).toBeGreaterThanOrEqual(LEGENDE_MIN_PX);
        // Elle n'est pas masquée par le fondu du « reste » : opacité pleine à t = 5 s.
        expect(style).not.toMatch(/opacity:0(;|$)/);
      });
    }
  }
});

// SUITE À TRAITER (relecture Opus #609, point 6) : la légende de CHI-D (géant) sur deux lignes descend dans la bande des sous-titres dès l'échelle 1, disposition
// d'origine ; la vidéo v-6e4a06b9c718 utilise CHI-E. À regarder sur une vraie image avant d'ajouter un test de hauteur pour CHI-D.
describe("légende du chiffre principal · ne déborde pas à droite et ne grossit pas dans une zone occupée", () => {
  /** Boîte de la légende, dans le repère de la variante (centre x = 540 : l'axe de l'échelle de `corps.tsx`). */
  function boite(code: string, style: string) {
    if (code === "CHI-B") {
      const g = geometrieAnneau(cadre);
      return { gauche: g.cx - g.r + g.ep / 2, largeur: 2 * g.r - g.ep };
    }
    return { gauche: Number(/left:(\d+(?:\.\d+)?)px/.exec(style)![1]), largeur: Number(/width:(\d+(?:\.\d+)?)px/.exec(style)![1]) };
  }
  for (const code of ["CHI-B", "CHI-C", "CHI-D", "CHI-E"]) {
    for (const echelle of [1, 0.85, 0.7, 0.66]) {
      it(`${code} · échelle ${echelle} : la boîte de « ${LEGENDE} » reste centrée sur 540, dans les marges (60 px), le texte passe à la ligne au lieu de déborder`, () => {
        const style = styleDeLegende(rendre(code, echelle, 1))!;
        const { gauche, largeur } = boite(code, style);
        const centre = gauche + largeur / 2;
        expect(centre).toBe(540);
        // Origine de la contre-échelle = milieu haut de la boîte : à l'écran, sa gauche et sa droite ne bougent pas.
        if (echelle < 1) expect(style).toMatch(/transform-origin:50% 0%/);
        const ecranGauche = 540 + (centre - 540) * echelle - largeur / 2;
        const ecranDroite = 540 + (centre - 540) * echelle + largeur / 2;
        expect(ecranGauche).toBeGreaterThanOrEqual(60);
        expect(ecranDroite).toBeLessThanOrEqual(1080 - 60);
        expect(style).not.toMatch(/white-space:nowrap/);
      });
    }
  }

  it("duel : agrandie vers le bas, la légende finit au-dessus de la pile des autres chiffres (e ≥ 0,66)", () => {
    const { zoneBas } = planDuel(donnees["CHI-C"], cadre);
    for (const e of [1, 0.85, 0.7, 0.66]) {
      const haut = Number(/top:(\d+(?:\.\d+)?)px/.exec(styleDeLegende(rendre("CHI-C", e, 1))!)![1]);
      // Duel « avant / après » (ancien.t défini, cas de la fixture) : légende posée à `cadre.bas - 96` ; sinon sous la zone finale.
      expect(haut).toBe(donnees["CHI-C"].duel?.ancien.t !== undefined ? cadre.bas - 96 : zoneBas + 24);
      const bas = cadre.haut + (haut - cadre.haut) * e + 62 * 1.15;
      const hautPile = cadre.haut + (cadre.bas - cadre.haut) * e + 16;
      expect(bas).toBeLessThanOrEqual(hautPile);
    }
  });

  it("anneau : agrandie vers le bas, la légende reste à l'intérieur de l'anneau (avant son bord intérieur bas)", () => {
    const g = geometrieAnneau(cadre);
    for (const e of [1, 0.85, 0.7, 0.66]) {
      // Haut de la légende : bas du chiffre (cy - 0,7 × taille + taille) + 14 ; hauteur agrandie : 62 × 1,15 / e.
      const bas = g.cy - g.taille * 0.7 + g.taille + 14 + (62 * 1.15) / e;
      expect(bas).toBeLessThanOrEqual(g.cy + g.r - g.ep / 2);
    }
  });

  it("objets : la grille de bulles commence sous la légende agrandie (aucun chevauchement)", () => {
    for (const e of [1, 0.85, 0.7, 0.66]) {
      const html = rendre("CHI-E", e, 1);
      const haut = Number(/top:(\d+(?:\.\d+)?)px/.exec(styleDeLegende(html)!)![1]);
      const bas = haut + (62 * 1.15) / e;
      const dy = cadre.haut - 300;
      const grille = 624 + dy + 52 + Math.round(71 * (1 / e - 1));
      expect(bas).toBeLessThanOrEqual(grille + 1);
    }
  });
});

describe("CHI-E (objets) · chiffre et légende centrés, écart avec la grille (relecture du 24/10/2026)", () => {
  it("le chiffre focal est centré dans une boîte de 936 px, la légende est centrée (text-align:center)", () => {
    const html = rendre("CHI-E", 1);
    const style = styleDeLegende(html)!;
    expect(style).toMatch(/text-align:center/);
    expect(style).toMatch(/left:72px/);
    expect(style).toMatch(/width:936px/);
    // La boîte du chiffre (premier bloc positionné) : 936 de large, contenu centré.
    const premier = /<div style="([^"]*)"/.exec(html)![1];
    expect(premier).toMatch(/left:72px/);
    expect(premier).toMatch(/width:936px/);
    expect(premier).toMatch(/display:flex/);
    expect(premier).toMatch(/justify-content:center/);
  });

  for (const e of [1, 0.7]) {
    it(`échelle ${e} : au moins 40 px entre le bas de la légende (top + 71 / échelle) et le haut de la grille`, () => {
      const html = rendre("CHI-E", e);
      const haut = Number(/top:(\d+(?:\.\d+)?)px/.exec(styleDeLegende(html)!)![1]);
      const grille = Number(/top:(\d+(?:\.\d+)?)px;width:\d+(?:\.\d+)?px;height:[\d.]+px;transform:rotate/.exec(html)![1]);
      expect(grille - (haut + 71 / e)).toBeGreaterThanOrEqual(40);
    });
  }
});

describe("pile · « 0 demande » + « perdue » : le nombre seul en grand, le mot dans la légende", () => {
  it("scinderChiffre sépare le nombre du mot, sauf pour une unité (%, h, min, sec, s, j, €)", () => {
    expect(scinderChiffre("0 demande", "perdue")).toEqual({ texte: "0", legende: "demande perdue" });
    expect(scinderChiffre("0 demande")).toEqual({ texte: "0", legende: "demande" });
    expect(scinderChiffre("2,5 jours ouvrés")).toEqual({ texte: "2,5", legende: "jours ouvrés" });
    for (const t of ["4 sec", "24h/24", "80%", "80 %", "12 h", "5 min", "3 s", "2 j", "40 €", "23 min"]) expect(scinderChiffre(t, "x")).toEqual({ texte: t, legende: "x" });
    expect(scinderChiffre("24h/24")).toEqual({ texte: "24h/24", legende: undefined });
  });

  it("Pile : la balise Anton contient « 0 » seul, la légende « demande perdue », jamais « >0 demande< »", () => {
    const d = donnees["CHI-E"];
    const html = renderToStaticMarkup(createElement(Pile, { d, t: 6, cadre, tailleFocale: 350 }));
    expect(html).not.toContain(">0 demande<");
    expect(html).toMatch(/>0<\/div>/);
    expect(html).toContain(">demande perdue</div>");
    expect(html).toContain(">24h/24<");
  });
});

// ── Défauts visuels de la vidéo v-0339175a9f88 (25/10/2026, compositions-iv/11) ─────────────────────────────────────
const doneesAnneau = (legende = LEGENDE, rangees = 2): DonneesEcranChiffresRendu => ({
  ...base("CHI-B", "80 %"),
  chiffres: [
    { texte: "80 %", legende, t: 0.4 },
    ...(rangees >= 1 ? [{ texte: "0 demande", legende: "perdue", t: 2 }] : []),
    ...(rangees >= 2 ? [{ texte: "24h/24", t: 3.5 }] : []),
  ],
  anneau: { valeur: 80, reste: { texte: "20 %", legende: "Limite atteinte" } },
});
const nombre = (re: RegExp, s: string) => Number(re.exec(s)![1]);

describe("D2 · pile centrée : le groupe chiffre + légende est centré sur x = 540 (cadres 4:5 et 9:16)", () => {
  for (const hauteur of [1350, 1920]) {
    it(`cadre ${hauteur} : centre du groupe = 540 ± 4, légende « demande perdue » sur UNE ligne`, () => {
      const c = cadreChiffres(hauteur);
      const d = { ...base("CHI-B", "80 %"), chiffres: [{ texte: "80 %", legende: LEGENDE, t: 0.4 }, { texte: "0 demande", legende: "perdue", t: 2 }] };
      const html = renderToStaticMarkup(createElement(Pile, { d, t: 6, cadre: c, tailleFocale: 330 }));
      const rangee = /left:(\d+(?:\.\d+)?)px;top:[\d.]+px;width:(\d+(?:\.\d+)?)px;height/.exec(html)!;
      const gauche = Number(rangee[1]);
      const colChiffre = nombre(/width:(\d+(?:\.\d+)?)px;flex:none/, html);
      const colLegende = nombre(/max-width:(\d+(?:\.\d+)?)px/, html);
      // Le chiffre (calé à droite de sa colonne) commence à gauche + colonne - sa largeur ; la légende finit à gauche + colonne + 36 + sa largeur réelle.
      const { texte } = scinderChiffre("0 demande", "perdue");
      const taille = nombre(/font-size:(\d+(?:\.\d+)?)px/, html);
      const debut = gauche + colChiffre - largeurAnton(texte, taille);
      const largeurLegende = Math.min(colLegende, largeurTexte("demande perdue", "inter-gras", 60));
      const fin = gauche + colChiffre + 36 + largeurLegende;
      expect((debut + fin) / 2).toBeGreaterThanOrEqual(536);
      expect((debut + fin) / 2).toBeLessThanOrEqual(544);
      expect(largeurTexte("demande perdue", "inter-gras", 60)).toBeLessThanOrEqual(colLegende);
    });
  }
});
