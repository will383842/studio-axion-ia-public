/**
 * Contrôles de RENDU RÉEL de chaque type de pages (Remotion + Chromium) : contenu MAXIMAL du schéma sans aucun débordement,
 * contenu MINIMAL sans zone vide de plus de 15 % de la hauteur. Ces tests demandent les dépendances de `studio-rendu`
 * (`npm ci` dans ce dossier) et un Chromium local (`STUDIO_RENDU_NAVIGATEUR`, ou celui de Playwright) : sans eux, ils sont
 * IGNORÉS (la CI ciblée des visuels n'installe pas studio-rendu). Le script `scripts/essai-visuel-m3a.ts` fait les mêmes contrôles.
 */
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { TYPES_PAGE } from "@/briques/visuels/registre-pages";
import { CHARTE_CARROUSEL } from "@/briques/visuels/charte-carrousel";
import { FORMAT, MARGE, OMBRE_ORANGE_DECALAGE, PAGE, ZONE_COMPTEUR } from "../../studio-rendu/compositions/visuels/commun/constantes";
import { decoderPng, type ImageRgb } from "../../studio-rendu/scripts/analyse-image";
import { controlerMax, controlerMin, PART_ZONE_VIDE_MAX } from "../../studio-rendu/scripts/controle-pages";
import { navigateurLocal, ouvrirRendeur, type Rendeur } from "../../studio-rendu/scripts/rendu-visuel";

const DISPONIBLE = existsSync(new URL("../../studio-rendu/node_modules/@remotion/renderer", import.meta.url)) && Boolean(navigateurLocal());
const MINUTES = 60_000;
// La couverture A (T01, validée en M1-04) est volontairement minimaliste : son titre court, centré, laisse du blanc. Les autres types sont tous contrôlés.
const SANS_CONTROLE_MIN = ["T01"];

const rvb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const proche = (image: ImageRgb, x: number, y: number, couleur: number[], ecart = 40) => {
  const i = (y * image.largeur + x) * 3;
  return couleur.every((c, k) => Math.abs(image.rgb[i + k]! - c) <= ecart);
};

/**
 * Boîte RÉELLE du bandeau « VOUS : … » de T26, mesurée sur les pixels du rendu : la plus haute suite de lignes, sous la carte « avec nous »,
 * dont la majorité des pixels de la largeur utile sont à l'encre (le texte crème et orange coupe l'aplat). Rend aussi le bord droit du texte crème.
 */
function boiteBandeauT26(image: ImageRgb) {
  const encre = rvb(CHARTE_CARROUSEL.couleurs.encre);
  const creme = rvb(CHARTE_CARROUSEL.couleurs.creme);
  const largeurUtile = FORMAT.largeur - 2 * MARGE;
  const pleine = (y: number) => {
    let n = 0;
    for (let x = MARGE; x < FORMAT.largeur - MARGE; x++) if (proche(image, x, y, encre)) n++;
    return n >= 0.5 * largeurUtile;
  };
  let meilleure = { haut: 0, bas: -1 };
  for (let y = Math.floor(image.hauteur / 2), debut = -1; y <= image.hauteur; y++) {
    if (y < image.hauteur && pleine(y)) {
      if (debut < 0) debut = y;
    } else if (debut >= 0) {
      if (y - 1 - debut > meilleure.bas - meilleure.haut) meilleure = { haut: debut, bas: y - 1 };
      debut = -1;
    }
  }
  const milieu = Math.round((meilleure.haut + meilleure.bas) / 2);
  let gauche = image.largeur;
  let droite = -1;
  for (let x = 0; x < image.largeur; x++) {
    if (proche(image, x, milieu, encre)) {
      gauche = Math.min(gauche, x);
      droite = Math.max(droite, x);
    }
  }
  let droiteTexte = -1;
  // Texte cherché à l'intérieur du bandeau, hors de ses coins arrondis (rayon 24 px) où le fond crème de la page apparaît.
  for (let y = meilleure.haut + 4; y <= meilleure.bas - 4; y++) for (let x = gauche + 24; x <= droite - 24; x++) if (proche(image, x, y, creme, 30)) droiteTexte = Math.max(droiteTexte, x);
  return { ...meilleure, gauche, droite, droiteTexte };
}

describe.skipIf(!DISPONIBLE)("rendu réel des types de pages", () => {
  let rendeur: Rendeur;
  beforeAll(async () => {
    rendeur = await ouvrirRendeur();
  }, 5 * MINUTES);

  it.each(TYPES_PAGE)("%s : contenu MAXIMAL = 0 débordement", async (type) => {
    const resultats = await controlerMax(rendeur, type);
    expect(resultats.length).toBeGreaterThan(0);
    for (const r of resultats) expect(r.erreur, `${type} ${r.nom}`).toBeNull();
  }, 5 * MINUTES);

  it.each(TYPES_PAGE.filter((t) => !SANS_CONTROLE_MIN.includes(t)))("%s : contenu MINIMAL = aucune zone vide de plus de 15 % de la hauteur", async (type) => {
    const resultats = await controlerMin(rendeur, type);
    expect(resultats.length).toBeGreaterThan(0);
    for (const r of resultats) expect(r.part, `${type} ${r.nom} : zone vide de ${r.hauteurVidePx} px`).toBeLessThanOrEqual(PART_ZONE_VIDE_MAX);
  }, 5 * MINUTES);

  // Bandeau de T26 : sa boîte RÉELLE (pas le bord choisi dans le code) suit le bord gauche de la marge et le bord droit des cartes
  // (qui réservent la place de leur ombre orange), s'arrête au-dessus du pied, et son texte ne va pas sous le compteur de Meta.
  it("T26 : boîte réelle du bandeau « VOUS : … » mesurée sur le rendu", async () => {
    const sortie = resolve(mkdtempSync(resolve(tmpdir(), "bandeau-t26-")), "page.png");
    const t26 = { type: "T26", titre: "Un cabinet, ses relances", avant: ["Relances oubliées", "Dossiers épars"], avec: ["Relances à date", "Dossiers rangés"], vous: "Et chez vous, qui relance les clients ?" };
    await rendeur.page({ version: "carrousel/1", alt: "Essai", pages: [{ type: "T01", titre: "Une couverture" }, t26, { type: "T21" }] }, 1, sortie, "png");
    const b = boiteBandeauT26(decoderPng(readFileSync(sortie)));
    expect(b.bas - b.haut, "hauteur du bandeau").toBeGreaterThanOrEqual(60);
    expect(Math.abs(b.gauche - MARGE), `bord gauche ${b.gauche}`).toBeLessThanOrEqual(2);
    expect(Math.abs(b.droite + 1 - (FORMAT.largeur - MARGE - OMBRE_ORANGE_DECALAGE)), `bord droit ${b.droite}`).toBeLessThanOrEqual(2);
    expect(b.bas, "au-dessus du pied").toBeLessThan(FORMAT.hauteur - MARGE - PAGE.hauteurPied);
    expect(b.droiteTexte, "du texte crème dans le bandeau").toBeGreaterThan(b.gauche);
    if (b.bas >= ZONE_COMPTEUR.haut) expect(b.droiteTexte, `texte du bandeau à x = ${b.droiteTexte}`).toBeLessThan(ZONE_COMPTEUR.gauche);
  }, 5 * MINUTES);

  // Le garde-fou lui-même : un texte qui ne tient pas FAIT ÉCHOUER le rendu, il n'est jamais coupé en silence.
  it("un mot trop long pour la largeur fait échouer le rendu d'un titre", async () => {
    const sortie = resolve(mkdtempSync(resolve(tmpdir(), "debordement-")), "page.jpg");
    const spec = { version: "carrousel/1", alt: "Essai", pages: [{ type: "T01", titre: "Une couverture" }, { type: "T06", titre: "x".repeat(30), points: ["a", "b", "c"].map((texte) => ({ texte })) }] };
    await expect(rendeur.page(spec, 1, sortie)).rejects.toThrow(/ne tient pas dans la largeur|déborde de son cadre/);
  }, 5 * MINUTES);

  it("un point de liste d'un seul mot trop long fait échouer le rendu", async () => {
    const sortie = resolve(mkdtempSync(resolve(tmpdir(), "debordement-")), "page.jpg");
    const spec = { version: "carrousel/1", alt: "Essai", pages: [{ type: "T01", titre: "Une couverture" }, { type: "T06", titre: "Une liste", points: [{ texte: "x".repeat(70) }, { texte: "b" }, { texte: "c" }] }] };
    await expect(rendeur.page(spec, 1, sortie)).rejects.toThrow(/déborde de son cadre/);
  }, 5 * MINUTES);
});
