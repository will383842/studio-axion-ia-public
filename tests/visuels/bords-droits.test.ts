/**
 * ART-1, tour 2 : bords droits du texte PAR GABARIT, en fonctions PURES (la géométrie que les gabarits posent en CSS, `geometrie.ts`).
 * Pour chaque colonne de texte et chaque facteur de remplissage (1 → maximum du gabarit), la boîte du texte ne touche aucune zone réservée :
 * la flèche de LinkedIn (x ≥ 920, y 560-790) partout, le compteur de Meta (x ≥ 860, y ≥ 1080) pour ce qui peut descendre au bas de la page.
 * Défaut vu en prod (T26) : le bandeau « VOUS » supposait l'étiquette à 150 px ; mesurée, elle fait 138,05 px × f → texte en zone du compteur.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BORD_DROIT_TEXTE, FORMAT, MARGE } from "../../studio-rendu/compositions/visuels/commun/constantes";
import { bordsAuFacteur, type Colonne } from "../../studio-rendu/compositions/visuels/commun/geometrie";
import { boiteEnZoneReservee, BORD_DROIT_TEXTE_BAS } from "../../studio-rendu/compositions/visuels/commun/zones";
import { colonnesT02 } from "../../studio-rendu/compositions/visuels/pages/T02";
import { colonnesT23 } from "../../studio-rendu/compositions/visuels/pages/T23";
import { colonnesT24, VARIANTES_T24 } from "../../studio-rendu/compositions/visuels/pages/T24";
import { COLONNES_T26, FACTEUR_MAX_T26, REMPLISSAGE_DROIT_BANDEAU, texteBandeauT26 } from "../../studio-rendu/compositions/visuels/pages/T26";
import { colonnesT28, FACTEUR_MAX_T28, VARIANTES_T28 } from "../../studio-rendu/compositions/visuels/pages/T28";

const lire = (f: string) => readFileSync(new URL(`../../studio-rendu/compositions/visuels/${f}`, import.meta.url), "utf8");

/** Facteurs essayés de 1 au maximum du gabarit, par pas de 0,05 (et le maximum lui-même). */
const facteurs = (max: number) => [...Array.from({ length: Math.floor((max - 1) / 0.05) + 1 }, (_, i) => 1 + i * 0.05), max];

/** Hauteurs témoins : une ligne dans la bande de la flèche LinkedIn ; une ligne au bas de la page (sous le compteur de Meta). */
const Y_FLECHE = { haut: 600, bas: 640 };
const Y_BAS = { haut: 1100, bas: 1140 };

/** Vrai si la colonne, au facteur f, reste hors des zones réservées (au bas de page si `bas`), et garde une largeur utile. */
function horsZones(c: Colonne, f: number, bas: boolean): { ok: boolean; detail: string } {
  const { gauche, droite } = bordsAuFacteur(c, f);
  const enZone = boiteEnZoneReservee({ gauche, droite, ...Y_FLECHE }) || (bas && boiteEnZoneReservee({ gauche, droite, ...Y_BAS }));
  return { ok: !enZone && droite - gauche >= 120, detail: `f = ${f.toFixed(2)} : ${gauche.toFixed(1)} → ${droite.toFixed(1)}` };
}

describe("T26 : bandeau « VOUS » (défaut vu en prod)", () => {
  it.each([138.05, 150, 175])("étiquette de %s px × f : le texte s'arrête à x = 860 au plus, pour tout facteur", (etiquette) => {
    for (const f of facteurs(FACTEUR_MAX_T26)) {
      const b = texteBandeauT26(etiquette * f, f);
      expect(b.droite, `f = ${f}`).toBeLessThanOrEqual(BORD_DROIT_TEXTE_BAS);
      expect(boiteEnZoneReservee({ gauche: b.gauche, droite: b.droite, ...Y_BAS }), `f = ${f}`).toBe(false);
      expect(b.droite - b.gauche, `f = ${f}`).toBeGreaterThan(400);
    }
  });
  it("le bord droit ne dépend ni de l'étiquette ni du facteur : remplissage droit = largeur de page − 860, texte sans maxWidth", () => {
    expect(texteBandeauT26(100, 1).droite).toBe(texteBandeauT26(220, 1.6).droite);
    const src = lire("pages/T26.tsx");
    expect(REMPLISSAGE_DROIT_BANDEAU).toBe(FORMAT.largeur - BORD_DROIT_TEXTE_BAS);
    // Remplissages écrits un à un : une clé `paddingRight` après le raccourci `padding` garde la place de la première (ordre des clés JS) et serait écrasée.
    expect(src).toContain("paddingLeft: MARGE, paddingRight: REMPLISSAGE_DROIT_BANDEAU");
    expect(src.slice(src.indexOf("TEXTES_FIXES_L9.t26Vous") - 400, src.indexOf("TEXTES_FIXES_L9.t26Vous"))).not.toMatch(/padding: `|DANS_LA_COLONNE/);
    expect(src).toContain('flex: "1 1 0", minWidth: 0');
    expect(src).not.toMatch(/MARGE \+ 150/);
  });
  it("le bandeau et les deux blocs restent hors zones à tout facteur", () => {
    for (const f of facteurs(FACTEUR_MAX_T26)) {
      for (const [nom, c] of Object.entries(COLONNES_T26)) expect(horsZones(c, f, nom === "outils").ok, `${nom} ${horsZones(c, f, true).detail}`).toBe(true);
    }
  });
});

describe("T24 : chaque case, chaque variante, 3 à 5 lignes", () => {
  it("SANS et AVEC hors zones ; les deux dernières lignes s'arrêtent avant le compteur", () => {
    for (let v = 0; v < VARIANTES_T24; v++)
      for (let n = 3; n <= 5; n++) {
        const lignes = colonnesT24(v, n);
        expect(lignes).toHaveLength(n);
        lignes.forEach((l, i) => {
          for (const f of facteurs(1.8)) for (const [cote, c] of Object.entries(l)) expect(horsZones(c, f, i >= n - 2).ok, `v${v} n${n} ligne ${i + 1} ${cote} ${horsZones(c, f, true).detail}`).toBe(true);
        });
      }
  });
  it("la colonne AVEC va jusqu'au bord permis (912, 860 en bas) : la droite de la page n'est plus vide", () => {
    for (let n = 3; n <= 5; n++) {
      const lignes = colonnesT24(0, n);
      expect(bordsAuFacteur(lignes[0].avec, 1).droite).toBe(BORD_DROIT_TEXTE);
      expect(bordsAuFacteur(lignes[n - 1].avec, 1).droite).toBe(BORD_DROIT_TEXTE_BAS);
    }
  });
});

describe("T28 : chaque nœud, 3 à 5 nœuds", () => {
  it("le texte reste dans son nœud et hors zones ; les deux derniers nœuds s'arrêtent avant le compteur", () => {
    for (let v = 0; v < VARIANTES_T28; v++)
      for (let n = 3; n <= 5; n++)
        colonnesT28(n, v).forEach((c, i) => {
          for (const f of facteurs(FACTEUR_MAX_T28)) expect(horsZones(c, f, i >= n - 2).ok, `v${v} n${n} nœud ${i + 1} ${horsZones(c, f, true).detail}`).toBe(true);
        });
  });
});

describe("T02 : cartes de 1 à 6", () => {
  it("chaque carte hors zones ; la dernière rangée s'arrête avant le compteur", () => {
    for (let n = 1; n <= 6; n++) {
      const cartes = colonnesT02(n);
      expect(cartes).toHaveLength(n);
      const rangees = Math.ceil(n / (n <= 3 ? 1 : 2));
      cartes.forEach((c, i) => {
        const derniere = Math.floor(i / (n <= 3 ? 1 : 2)) === rangees - 1;
        for (const f of facteurs(n <= 3 ? 2.4 : 1.9)) expect(horsZones(c, f, derniere).ok, `${n} cartes, carte ${i + 1} ${horsZones(c, f, true).detail}`).toBe(true);
      });
    }
  });
  it("sur deux colonnes, la carte de gauche ne passe pas dans la colonne de droite", () => {
    for (const n of [4, 5, 6]) expect(bordsAuFacteur(colonnesT02(n)[0], 1).droite).toBeLessThanOrEqual(MARGE + (BORD_DROIT_TEXTE - MARGE - 40) / 2);
  });
});

describe("T23 : questions (2 à 4), avec et sans icônes", () => {
  it("chaque question hors zones ; les deux dernières s'arrêtent avant le compteur", () => {
    for (let n = 2; n <= 4; n++)
      for (const icones of [true, false])
        colonnesT23(n, icones).forEach((c, i) => {
          for (const f of facteurs(2.4)) expect(horsZones(c, f, i >= n - 2).ok, `n${n} icônes ${icones} question ${i + 1} ${horsZones(c, f, true).detail}`).toBe(true);
        });
  });
});
